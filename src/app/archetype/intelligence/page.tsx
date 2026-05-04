'use client'

/**
 * /archetype/intelligence — Civic Archetype Intelligence
 *
 * Cross-analysis of how each civic archetype votes on platform topics.
 * Shows which archetypes lean progressive vs conservative, which topics
 * divide the archetypes most, and which issues unite them all.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { ARCHETYPE_CONFIG, ARCHETYPE_IDS, type ArchetypeId } from '@/lib/config/archetypes'
import type { IntelligenceResponse, ArchetypeTendency, DivisiveTopic } from '@/app/api/archetype/intelligence/route'

// ─── Lean label helper ────────────────────────────────────────────────────────

function leanLabel(pct: number): { label: string; color: string } {
  if (pct >= 75) return { label: 'Strongly FOR', color: 'text-for-300' }
  if (pct >= 60) return { label: 'Leaning FOR', color: 'text-for-400' }
  if (pct >= 55) return { label: 'Slight FOR', color: 'text-for-500' }
  if (pct >= 45) return { label: 'Balanced', color: 'text-surface-400' }
  if (pct >= 40) return { label: 'Slight AGAINST', color: 'text-against-500' }
  if (pct >= 25) return { label: 'Leaning AGAINST', color: 'text-against-400' }
  return { label: 'Strongly AGAINST', color: 'text-against-300' }
}

// ─── Archetype Tendency Card ──────────────────────────────────────────────────

function ArchetypeTendencyCard({
  tendency,
  rank,
}: {
  tendency: ArchetypeTendency
  rank: number
}) {
  const config = ARCHETYPE_CONFIG[tendency.archetype as ArchetypeId]
  if (!config) return null
  const Icon = config.icon
  const lean = leanLabel(tendency.blue_pct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.06 }}
      className={cn(
        'rounded-2xl border p-4',
        config.bgColor,
        config.borderColor,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border', config.bgColor, config.borderColor)}>
          <Icon className={cn('h-4 w-4', config.color)} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className={cn('text-sm font-mono font-bold truncate', config.color)}>{config.name}</p>
          <p className="text-[11px] font-mono text-surface-500 truncate italic">{config.tagline}</p>
        </div>
      </div>

      {/* Vote bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-for-400 uppercase tracking-wider">FOR</span>
          <span className="text-[10px] font-mono text-against-400 uppercase tracking-wider">AGAINST</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden gap-px bg-surface-300">
          <div
            className="bg-for-500 rounded-l-full transition-all duration-700"
            style={{ width: `${tendency.blue_pct}%` }}
          />
          <div
            className="bg-against-500 rounded-r-full flex-1 transition-all duration-700"
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] font-mono font-semibold text-for-400">{tendency.blue_pct}%</span>
          <span className="text-[11px] font-mono text-surface-500">{tendency.total.toLocaleString()} votes</span>
          <span className="text-[11px] font-mono font-semibold text-against-400">{100 - tendency.blue_pct}%</span>
        </div>
      </div>

      {/* Lean badge */}
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-surface-300/50">
        <span className={cn('text-xs font-mono font-semibold', lean.color)}>{lean.label}</span>
        <span className="text-[10px] font-mono text-surface-500">
          {tendency.blue_count.toLocaleString()} / {tendency.red_count.toLocaleString()}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Topic Analysis Row ───────────────────────────────────────────────────────

function TopicAnalysisRow({
  topic,
  variant,
  index,
}: {
  topic: DivisiveTopic
  variant: 'divisive' | 'unifying'
  index: number
}) {
  const [expanded, setExpanded] = useState(false)

  // Get archetypes with data, sorted by their blue_pct
  const archEntries = ARCHETYPE_IDS
    .filter((id) => topic.archetype_pcts[id] !== null && topic.archetype_pcts[id] !== undefined)
    .map((id) => ({ id, pct: topic.archetype_pcts[id] as number }))
    .sort((a, b) => b.pct - a.pct)

  const maxPct = Math.max(...archEntries.map((e) => e.pct))
  const minPct = Math.min(...archEntries.map((e) => e.pct))
  const spread = maxPct - minPct

  const statusColors: Record<string, string> = {
    proposed: 'text-surface-400 bg-surface-300/20 border-surface-400/30',
    active: 'text-for-400 bg-for-500/10 border-for-500/30',
    voting: 'text-purple bg-purple/10 border-purple/30',
    law: 'text-gold bg-gold/10 border-gold/30',
    failed: 'text-against-400 bg-against-500/10 border-against-500/30',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: variant === 'divisive' ? -12 : 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-surface-200/50 transition-colors"
        aria-expanded={expanded}
      >
        {/* Rank */}
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-300 text-[10px] font-mono font-bold text-surface-500 flex items-center justify-center mt-0.5">
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
            )}
            <span
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                statusColors[topic.status] ?? 'text-surface-500 bg-surface-200 border-surface-300',
              )}
            >
              {topic.status.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {topic.total_votes.toLocaleString()} votes
            </span>
            {variant === 'divisive' && (
              <span className="text-[10px] font-mono text-against-400 font-semibold">
                ±{Math.round(spread / 2)}pt spread
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          {/* Global lean */}
          <div className="text-right">
            <p className="text-[10px] font-mono text-surface-500">Overall</p>
            <p className={cn('text-xs font-mono font-bold', topic.global_blue_pct >= 50 ? 'text-for-400' : 'text-against-400')}>
              {topic.global_blue_pct}% FOR
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-surface-500 flex-shrink-0" />
          )}
        </div>
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
            <div className="px-4 pb-4 pt-0 border-t border-surface-300">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3 mt-3">
                {variant === 'divisive' ? 'Archetype split' : 'Archetype consensus'}
              </p>

              {/* Bar chart for each archetype */}
              <div className="space-y-2">
                {archEntries.map(({ id, pct }) => {
                  const cfg = ARCHETYPE_CONFIG[id as ArchetypeId]
                  if (!cfg) return null
                  const Icon = cfg.icon
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <Icon className={cn('h-3 w-3 flex-shrink-0', cfg.color)} aria-hidden="true" />
                      <span className="text-[10px] font-mono text-surface-500 w-24 truncate flex-shrink-0">
                        {cfg.name}
                      </span>
                      <div className="flex-1 flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              pct >= 50 ? 'bg-for-500' : 'bg-against-500',
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={cn(
                          'text-[10px] font-mono font-semibold w-8 text-right flex-shrink-0',
                          pct >= 50 ? 'text-for-400' : 'text-against-400',
                        )}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Link
                href={`/topic/${topic.id}`}
                className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                View topic
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function IntelligenceSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-48 rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-6 w-44 rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ArchetypeIntelligencePage() {
  const [data, setData] = useState<IntelligenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/archetype/intelligence')
      if (!res.ok) throw new Error('Failed to load intelligence data')
      const json = await res.json()
      setData(json as IntelligenceResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-start gap-3">
            <Link
              href="/archetype"
              className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors mt-0.5"
              aria-label="Back to Archetype Quiz"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Brain className="h-5 w-5 text-purple" aria-hidden="true" />
                <h1 className="font-mono text-2xl font-bold text-white">
                  Archetype Intelligence
                </h1>
              </div>
              <p className="text-sm font-mono text-surface-500 max-w-xl">
                How do the 8 civic archetypes vote? See which topics divide them and which unite them.
              </p>
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-40"
            aria-label="Refresh data"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && <IntelligenceSkeleton />}

        {error && (
          <EmptyState
            icon={BarChart2}
            title="Couldn't load intelligence data"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {data && !loading && (
          <div className="space-y-10">

            {/* ── Meta stats ────────────────────────────────────────────── */}
            {data.total_archetype_votes > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-200 border border-surface-300">
                  <Users className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
                  <span className="text-xs font-mono text-surface-400">
                    {data.total_archetype_votes.toLocaleString()} archetype-tagged votes analysed
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-200 border border-surface-300">
                  <Sparkles className="h-3.5 w-3.5 text-purple" aria-hidden="true" />
                  <span className="text-xs font-mono text-surface-400">
                    {data.tendencies.length} of 8 archetypes active
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Info className="h-3 w-3 text-surface-600" aria-hidden="true" />
                  <span className="text-[10px] font-mono text-surface-600">
                    Based on last {data.sample_size.toLocaleString()} votes
                  </span>
                </div>
              </div>
            )}

            {/* ── Archetype Tendencies ───────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-gold" aria-hidden="true" />
                <h2 className="font-mono text-base font-bold text-white uppercase tracking-wider">
                  Voting Tendencies
                </h2>
                <span className="text-xs font-mono text-surface-500">How each archetype votes across all topics</span>
              </div>

              {data.tendencies.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No archetype data yet"
                  description="Take the Civic Archetype quiz to start contributing to this analysis."
                  action={{ label: 'Take the quiz', href: '/archetype' }}
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {data.tendencies.map((t, i) => (
                    <ArchetypeTendencyCard key={t.archetype} tendency={t} rank={i} />
                  ))}
                  {/* Placeholders for archetypes with no data yet */}
                  {ARCHETYPE_IDS
                    .filter((id) => !data.tendencies.find((t) => t.archetype === id))
                    .map((id) => {
                      const cfg = ARCHETYPE_CONFIG[id]
                      const Icon = cfg.icon
                      return (
                        <div
                          key={id}
                          className="rounded-2xl border border-surface-300/40 bg-surface-200/30 p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[140px]"
                        >
                          <Icon className="h-5 w-5 text-surface-600" aria-hidden="true" />
                          <p className="text-xs font-mono text-surface-600">{cfg.name}</p>
                          <p className="text-[10px] font-mono text-surface-600">No votes yet</p>
                        </div>
                      )
                    })}
                </div>
              )}
            </section>

            {/* ── Most Divisive Topics ───────────────────────────────────── */}
            {data.divisive.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-against-400" aria-hidden="true" />
                  <h2 className="font-mono text-base font-bold text-white uppercase tracking-wider">
                    Most Divisive Topics
                  </h2>
                  <span className="text-xs font-mono text-surface-500">Archetypes disagree most here</span>
                </div>

                <div className="space-y-2">
                  {data.divisive.map((topic, i) => (
                    <TopicAnalysisRow
                      key={topic.id}
                      topic={topic}
                      variant="divisive"
                      index={i}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Most Unifying Topics ──────────────────────────────────── */}
            {data.unifying.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="h-4 w-4 text-emerald" aria-hidden="true" />
                  <h2 className="font-mono text-base font-bold text-white uppercase tracking-wider">
                    Cross-Archetype Consensus
                  </h2>
                  <span className="text-xs font-mono text-surface-500">Every archetype agrees on these</span>
                </div>

                <div className="space-y-2">
                  {data.unifying.map((topic, i) => (
                    <TopicAnalysisRow
                      key={topic.id}
                      topic={topic}
                      variant="unifying"
                      index={i}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Explore CTA ────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-purple/30 bg-purple/5 p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-mono font-bold text-white mb-0.5">
                  Discover your civic archetype
                </p>
                <p className="text-xs font-mono text-surface-500">
                  Take the 10-question quiz to see how you compare with other civic personalities.
                </p>
              </div>
              <Link
                href="/archetype"
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple text-white text-xs font-mono font-semibold hover:bg-purple/80 transition-colors"
              >
                Take quiz
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
