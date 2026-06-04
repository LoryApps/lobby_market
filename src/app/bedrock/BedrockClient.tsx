'use client'

/**
 * /bedrock — The Civic Bedrock
 *
 * Surfaces the most durable, democratically-legitimate laws on Lobby Market:
 * those that have held strong consensus for the longest time. Age ×
 * consensus strength × vote weight = Bedrock Score.
 *
 * Tiers:
 *   Constitutional (≥70% consensus gap) — near-universal accord, the platform's charter
 *   Foundational   (50–69%)             — strong mandate, pillar of civic code
 *   Established    (30–49%)             — solid supermajority, well-settled
 *   Settled        (10–29%)             — clear majority, broadly accepted
 *   Contested      (<10%)               — narrow majority, potentially revisable
 *
 * Distinct from:
 *   /zenith         — current high-consensus topics (includes proposals, not just laws)
 *   /legacy         — historical record of all past outcomes
 *   /laws           — full law codex, no scoring
 *   /inheritance    — laws sorted by age alone
 *   /covenant       — does not exist; this IS the consensus-strength view
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Layers,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { BedrockLaw, BedrockResponse, BedrockStats, BedrockTier } from '@/app/api/topics/bedrock/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics:   TrendingUp,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  Scale,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<BedrockTier, {
  label: string
  color: string
  bg: string
  border: string
  ring: string
  desc: string
}> = {
  constitutional: {
    label: 'Constitutional',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    ring: 'ring-gold/30',
    desc: '≥70% consensus gap',
  },
  foundational: {
    label: 'Foundational',
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    ring: 'ring-for-500/20',
    desc: '50–69%',
  },
  established: {
    label: 'Established',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    ring: 'ring-emerald-500/20',
    desc: '30–49%',
  },
  settled: {
    label: 'Settled',
    color: 'text-surface-300',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/30',
    ring: 'ring-surface-400/20',
    desc: '10–29%',
  },
  contested: {
    label: 'Contested',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    ring: 'ring-against-500/20',
    desc: '<10%',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysLabel(days: number): string {
  if (days >= 365) {
    const years = (days / 365).toFixed(1)
    return `${years}y`
  }
  if (days >= 30) return `${Math.floor(days / 30)}mo`
  return `${days}d`
}

function consensusBar(bluePct: number) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  const isFor = forPct >= 50
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 flex rounded-full overflow-hidden h-1.5">
        <div className="bg-for-500/80 transition-all" style={{ width: `${forPct}%` }} />
        <div className="bg-against-500/80 transition-all" style={{ width: `${againstPct}%` }} />
      </div>
      <div className={cn('flex items-center gap-1 text-[10px] font-mono shrink-0', isFor ? 'text-for-400' : 'text-against-400')}>
        {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
        {isFor ? `${forPct}% For` : `${againstPct}% Against`}
      </div>
    </div>
  )
}

// ─── BedrockCard ──────────────────────────────────────────────────────────────

function BedrockCard({ law, rank }: { law: BedrockLaw; rank: number }) {
  const cfg = TIER_CONFIG[law.tier]
  const CategoryIcon = law.category ? (CATEGORY_ICONS[law.category] ?? Scale) : Scale

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(rank - 1, 8) * 0.04 }}
    >
      <Link
        href={`/law/${law.id}`}
        className={cn(
          'block rounded-xl border bg-surface-100 p-4 transition-all duration-200',
          'hover:bg-surface-150 hover:border-surface-400',
          cfg.border,
          `ring-1 ${cfg.ring}`,
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500'
        )}
      >
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-surface-200 border border-surface-300">
            <span className="text-xs font-mono font-bold text-surface-400">#{rank}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border', cfg.bg, cfg.border, cfg.color)}>
                <Layers className="h-2.5 w-2.5" />
                {cfg.label}
              </span>
              {law.category && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                  <CategoryIcon className="h-2.5 w-2.5" />
                  {law.category}
                </span>
              )}
              <span className="text-[10px] font-mono text-surface-600 ml-auto shrink-0">
                {daysLabel(law.days_as_law)} as law
              </span>
            </div>

            {/* Statement */}
            <p className="text-sm font-medium text-white leading-snug line-clamp-2">
              {law.statement}
            </p>

            {/* Consensus bar */}
            {consensusBar(law.blue_pct)}

            {/* Footer stats */}
            <div className="flex items-center gap-4 pt-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-surface-500 font-mono">Consensus</span>
                <span className={cn('text-[10px] font-mono font-semibold', cfg.color)}>
                  {law.consensus_strength}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-surface-500 font-mono">Votes</span>
                <span className="text-[10px] font-mono text-surface-300">
                  {law.total_votes.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-[10px] text-surface-500 font-mono">Score</span>
                <span className="text-[10px] font-mono font-bold text-gold">
                  {law.bedrock_score.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'text-white' }: {
  label: string
  value: React.ReactNode
  sub?: string
  color?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-100 border border-surface-300 p-3">
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      <span className={cn('text-xl font-mono font-bold', color)}>{value}</span>
      {sub && <span className="text-[10px] text-surface-600">{sub}</span>}
    </div>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function BedrockSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function BedrockClient() {
  const [data, setData] = useState<BedrockResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (cat: string | null, isRefresh = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const url = new URL('/api/topics/bedrock', window.location.origin)
      if (cat) url.searchParams.set('category', cat)
      const res = await fetch(url.toString(), { signal: ctrl.signal })
      if (!res.ok) throw new Error('fetch failed')
      const json: BedrockResponse = await res.json()
      setData(json)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setData({ laws: [], stats: { total_laws: 0, avg_consensus: 0, constitutional_count: 0, oldest_law: null, strongest_law: null, avg_days_as_law: 0 }, category: cat })
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(category)
    return () => abortRef.current?.abort()
  }, [category, load])

  const laws = data?.laws ?? []
  const stats: BedrockStats = data?.stats ?? {
    total_laws: 0,
    avg_consensus: 0,
    constitutional_count: 0,
    oldest_law: null,
    strongest_law: null,
    avg_days_as_law: 0,
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gold/10 border border-gold/30">
              <Layers className="h-5 w-5 text-gold" aria-hidden="true" />
            </div>
            <h1 className="font-mono text-2xl font-bold text-white tracking-tight">
              The Civic Bedrock
            </h1>
          </div>
          <p className="text-sm text-surface-400 leading-relaxed mt-2 pl-12">
            Laws ranked by democratic permanence — the oldest, most consensus-backed
            pillars of the platform&rsquo;s civic code.
          </p>
        </div>

        {/* Stats strip */}
        {!loading && stats.total_laws > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6"
          >
            <StatCard
              label="Laws"
              value={<AnimatedNumber value={stats.total_laws} />}
              sub="active"
              color="text-white"
            />
            <StatCard
              label="Avg consensus"
              value={<><AnimatedNumber value={stats.avg_consensus} />%</>}
              sub="gap from 50/50"
              color="text-gold"
            />
            <StatCard
              label="Constitutional"
              value={<AnimatedNumber value={stats.constitutional_count} />}
              sub="≥70% consensus"
              color="text-gold"
            />
            <StatCard
              label="Avg age"
              value={daysLabel(stats.avg_days_as_law)}
              sub="as established law"
              color="text-for-300"
            />
          </motion.div>
        )}

        {/* Category filter */}
        <div className="flex items-center gap-2 mb-5 flex-wrap" role="group" aria-label="Filter by category">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-mono transition-all',
              'border focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500',
              category === null
                ? 'bg-surface-300 text-white border-surface-400'
                : 'bg-surface-100 text-surface-400 border-surface-300 hover:text-white'
            )}
            aria-pressed={category === null}
          >
            All
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] ?? Scale
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-all',
                  'border focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500',
                  category === cat
                    ? 'bg-gold/20 text-gold border-gold/50'
                    : 'bg-surface-100 text-surface-400 border-surface-300 hover:text-white'
                )}
                aria-pressed={category === cat}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {cat}
              </button>
            )
          })}
        </div>

        {/* Refresh button */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-mono text-surface-500">
            {loading ? 'Loading…' : `${laws.length} law${laws.length !== 1 ? 's' : ''}${category ? ` in ${category}` : ''}`}
          </p>
          <button
            onClick={() => load(category, true)}
            disabled={loading || refreshing}
            aria-label="Refresh bedrock"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Loading state */}
        {loading && <BedrockSkeleton />}

        {/* Empty state */}
        {!loading && laws.length === 0 && (
          <EmptyState
            icon={Layers}
            title="No bedrock laws found"
            description={
              category
                ? `No established ${category} laws with sufficient vote data yet.`
                : 'No established laws with sufficient vote data yet.'
            }
            actions={
              category
                ? [{ label: 'Clear filter', onClick: () => setCategory(null) }]
                : undefined
            }
          />
        )}

        {/* Law list */}
        {!loading && laws.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={category ?? 'all'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {laws.map((law, i) => (
                <BedrockCard key={law.id} law={law} rank={i + 1} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Explainer footer */}
        {!loading && laws.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 rounded-xl border border-surface-300 bg-surface-100 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              <span className="text-xs font-mono text-surface-400">What is the Bedrock Score?</span>
            </div>
            <p className="text-xs text-surface-500 leading-relaxed">
              Bedrock Score = <strong className="text-surface-300">days as law</strong> ×{' '}
              <strong className="text-gold">consensus strength</strong> ×{' '}
              <strong className="text-for-300">log(votes)</strong>. A law that has held 80% consensus
              for two years outweighs a recent landslide with fewer votes. These are the laws the platform
              has staked its democratic credibility on.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {(Object.entries(TIER_CONFIG) as [BedrockTier, typeof TIER_CONFIG[BedrockTier]][]).map(
                ([, cfg]) => (
                  <div key={cfg.label} className="flex items-center gap-2">
                    <span className={cn('text-xs font-mono font-semibold', cfg.color)}>{cfg.label}</span>
                    <span className="text-[10px] text-surface-600">{cfg.desc}</span>
                  </div>
                )
              )}
            </div>
          </motion.div>
        )}

        {/* Related pages */}
        <nav aria-label="Related civic analysis" className="mt-4">
          <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider mb-2">
            Related
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: '/laws',         label: 'Law Codex' },
              { href: '/zenith',       label: 'Zenith' },
              { href: '/inheritance',  label: 'Inheritance' },
              { href: '/legacy',       label: 'Legacy' },
              { href: '/polarization', label: 'Polarization' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-mono',
                  'bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white',
                  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500',
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </main>

      <BottomNav />
    </div>
  )
}
