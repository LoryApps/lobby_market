'use client'

/**
 * /law/quality — Civic Law Quality Index
 *
 * Ranks every established law by its democratic mandate — a composite score
 * combining voter participation (how many people weighed in) and consensus
 * strength (how decisively the community decided).
 *
 * Score formula: √(total_votes) × mandate_strength
 * mandate_strength = |blue_pct − 50| / 50  (0 = dead-heat, 1 = unanimous)
 *
 * Tier system:
 *   Unanimous   ≥ 90 % on winning side
 *   Strong      80–89 %
 *   Clear       70–79 %
 *   Slim        55–69 %
 *   Contested   50–54 %
 *
 * Distinct from:
 *   /law          — alphabetical codex browse
 *   /law/timeline — chronological history
 *   /law/atlas    — geographic view
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpDown,
  Award,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { QualityLaw, QualityLawsResponse, ConsensusTier } from '@/app/api/laws/quality/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function fmtScore(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toFixed(1)
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<ConsensusTier, {
  label: string
  shortLabel: string
  text: string
  bg: string
  border: string
  icon: typeof Trophy
  description: string
}> = {
  unanimous: {
    label: 'Unanimous',
    shortLabel: 'Unanimous',
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Trophy,
    description: '90%+ agreement',
  },
  strong: {
    label: 'Strong Consensus',
    shortLabel: 'Strong',
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: Award,
    description: '80–89% agreement',
  },
  clear: {
    label: 'Clear Majority',
    shortLabel: 'Clear',
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: Zap,
    description: '70–79% agreement',
  },
  slim: {
    label: 'Slim Majority',
    shortLabel: 'Slim',
    text: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: Scale,
    description: '55–69% agreement',
  },
  contested: {
    label: 'Contested',
    shortLabel: 'Contested',
    text: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: Flame,
    description: '50–54% agreement',
  },
}

// ─── Category styles ──────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
}

function getCategoryStyle(cat: string | null) {
  return CATEGORY_STYLES[cat ?? ''] ?? {
    text: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
  }
}

const CATEGORIES = [
  'All',
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

type SortKey = 'quality' | 'votes' | 'mandate' | 'recent'

const SORT_OPTIONS: { key: SortKey; label: string; icon: typeof BarChart2 }[] = [
  { key: 'quality',  label: 'Quality Score',     icon: BarChart2 },
  { key: 'mandate',  label: 'Strongest Mandate', icon: Award },
  { key: 'votes',    label: 'Most Votes',         icon: Users },
  { key: 'recent',   label: 'Most Recent',        icon: Gavel },
]

// ─── Subcomponents ────────────────────────────────────────────────────────────

function QualityBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.min((score / max) * 100, 100) : 0
  return (
    <div className="h-1.5 w-full bg-surface-300/40 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-gold/80 to-gold rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  )
}

function VoteBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  const forW = forPct > 0 && forPct < 3 ? 3 : forPct
  const agnW = againstPct > 0 && againstPct < 3 ? 3 : againstPct

  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span className="text-for-400 font-bold w-8 text-right">{forPct}%</span>
      <div className="flex-1 h-1 bg-surface-300/30 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-for-500 rounded-l-full"
          style={{ width: `${forW}%` }}
        />
        <div
          className="h-full bg-against-500 rounded-r-full ml-auto"
          style={{ width: `${agnW}%` }}
        />
      </div>
      <span className="text-against-400 font-bold w-8">{againstPct}%</span>
    </div>
  )
}

function LawCard({ law, rank, maxScore }: { law: QualityLaw; rank: number; maxScore: number }) {
  const tier = TIER_CONFIG[law.consensus_tier]
  const TierIcon = tier.icon
  const catStyle = getCategoryStyle(law.category)
  const isTop3 = rank <= 3

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(rank * 0.03, 0.4) }}
    >
      <Link
        href={`/law/${law.id}`}
        className={cn(
          'flex gap-4 p-4 rounded-xl border transition-all group',
          'bg-surface-100 hover:bg-surface-200/80',
          isTop3
            ? 'border-gold/20 hover:border-gold/40'
            : 'border-surface-300/60 hover:border-surface-400/60'
        )}
      >
        {/* Rank */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
          <span
            className={cn(
              'w-8 h-8 flex items-center justify-center rounded-lg text-sm font-mono font-bold',
              rank === 1 ? 'bg-gold/20 text-gold border border-gold/40' :
              rank === 2 ? 'bg-surface-300/40 text-surface-400 border border-surface-400/30' :
              rank === 3 ? 'bg-against-500/10 text-against-400 border border-against-500/30' :
              'text-surface-500 bg-surface-200 border border-surface-300/40'
            )}
          >
            {rank}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1.5 flex-shrink-0">
              {/* Tier badge */}
              <span
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wide border',
                  tier.bg, tier.border, tier.text
                )}
              >
                <TierIcon className="h-2.5 w-2.5" />
                {tier.shortLabel}
              </span>

              {/* Category */}
              {law.category && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border',
                    catStyle.bg, catStyle.border, catStyle.text
                  )}
                >
                  {law.category}
                </span>
              )}
            </div>

            {/* Quality score */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-xs font-mono font-bold text-gold tabular-nums">
                {fmtScore(law.quality_score)}
              </span>
              <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
            </div>
          </div>

          {/* Statement */}
          <p className="text-sm font-mono text-white leading-relaxed line-clamp-2">
            {law.statement}
          </p>

          {/* Quality bar */}
          <QualityBar score={law.quality_score} max={maxScore} />

          {/* Stats row */}
          <div className="flex items-center justify-between gap-3">
            <VoteBar bluePct={law.blue_pct} />

            <div className="flex items-center gap-3 flex-shrink-0 text-[10px] font-mono text-surface-500">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {fmtVotes(law.total_votes)}
              </span>
              <span className="hidden sm:block">{relativeDate(law.established_at)}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function CardSkeleton() {
  return (
    <div className="flex gap-4 p-4 rounded-xl border border-surface-300/60 bg-surface-100">
      <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-3 w-full rounded" />
      </div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: QualityLawsResponse['stats'] }) {
  const tiers: Array<{ key: keyof typeof stats; tier: ConsensusTier; label: string }> = [
    { key: 'unanimous_count', tier: 'unanimous', label: 'Unanimous' },
    { key: 'strong_count', tier: 'strong', label: 'Strong' },
    { key: 'clear_count', tier: 'clear', label: 'Clear' },
    { key: 'slim_count', tier: 'slim', label: 'Slim' },
    { key: 'contested_count', tier: 'contested', label: 'Contested' },
  ]

  return (
    <div className="grid grid-cols-5 gap-2">
      {tiers.map(({ key, tier, label }) => {
        const config = TIER_CONFIG[tier]
        const TierIcon = config.icon
        const count = stats[key] as number
        return (
          <div
            key={tier}
            className={cn(
              'flex flex-col items-center gap-1 p-2.5 rounded-xl border',
              config.bg, config.border
            )}
          >
            <TierIcon className={cn('h-3.5 w-3.5', config.text)} />
            <span className={cn('text-base font-mono font-bold', config.text)}>{count}</span>
            <span className="text-[9px] font-mono text-surface-500 text-center leading-none">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawQualityPage() {
  const [data, setData] = useState<QualityLawsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('All')
  const [sort, setSort] = useState<SortKey>('quality')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const fetch_ = useCallback(async (cat: string, s: SortKey) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sort: s, limit: '50' })
      if (cat !== 'All') params.set('category', cat)
      const res = await fetch(`/api/laws/quality?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load law quality data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch_(category, sort)
  }, [fetch_, category, sort])

  const maxScore = data?.laws[0]?.quality_score ?? 1
  const currentSort = SORT_OPTIONS.find(o => o.key === sort)!

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/law"
            aria-label="Back to Law Codex"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0 mt-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
                <Trophy className="h-4 w-4 text-gold" />
              </div>
              <h1 className="font-mono text-xl font-bold text-white">Civic Law Quality Index</h1>
            </div>
            <p className="text-xs font-mono text-surface-500 ml-10">
              Laws ranked by democratic mandate — participation × decisiveness
            </p>
          </div>

          <button
            onClick={() => fetch_(category, sort)}
            aria-label="Refresh"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0 mt-0.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Stats overview ── */}
        <AnimatePresence mode="wait">
          {data && !loading && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 space-y-3"
            >
              {/* Tier counts */}
              <StatsBar stats={data.stats} />

              {/* Platform summary */}
              <div className="flex items-center gap-4 px-4 py-3 bg-surface-100 border border-surface-300 rounded-xl text-xs font-mono text-surface-500">
                <span className="flex items-center gap-1.5">
                  <Gavel className="h-3.5 w-3.5 text-gold" />
                  <span className="text-white font-semibold">{data.stats.total}</span>
                  {category !== 'All' ? ` ${category}` : ''} laws
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  avg {fmtVotes(data.stats.avg_votes)} votes
                </span>
                <span className="flex items-center gap-1.5">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  avg +{data.stats.avg_mandate}% mandate
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filters row ── */}
        <div className="flex items-center gap-2 mb-4">
          {/* Category filter — scrollable */}
          <div className="flex-1 overflow-x-auto scrollbar-none">
            <div className="flex gap-1.5 min-w-max">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all whitespace-nowrap',
                    category === cat
                      ? 'bg-gold/15 border-gold/40 text-gold'
                      : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:bg-surface-200'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Sort picker */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowSortMenu(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                'bg-surface-200/80 border-surface-300 text-surface-400 hover:text-white hover:bg-surface-200'
              )}
            >
              <ArrowUpDown className="h-3 w-3" />
              {currentSort.label}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showSortMenu && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 z-20 bg-surface-100 border border-surface-300 rounded-xl shadow-2xl w-44 py-1 overflow-hidden"
                >
                  {SORT_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.key}
                        onClick={() => { setSort(opt.key); setShowSortMenu(false) }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono transition-colors text-left',
                          sort === opt.key
                            ? 'text-gold bg-gold/10'
                            : 'text-surface-400 hover:text-white hover:bg-surface-200'
                        )}
                      >
                        <Icon className="h-3 w-3 flex-shrink-0" />
                        {opt.label}
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Legend ── */}
        <details className="mb-4 group">
          <summary className="flex items-center gap-2 text-xs font-mono text-surface-500 cursor-pointer hover:text-surface-400 transition-colors list-none select-none">
            <BarChart2 className="h-3 w-3" />
            How quality scores work
            <ChevronDown className="h-3 w-3 ml-auto transition-transform group-open:rotate-180" />
          </summary>
          <motion.div
            className="mt-2 p-3 bg-surface-100 border border-surface-300 rounded-xl text-xs font-mono text-surface-500 space-y-1.5"
          >
            <p>
              <span className="text-gold font-semibold">Quality Score</span> ={' '}
              √(votes) × mandate_strength
            </p>
            <p>
              <span className="text-white">mandate_strength</span> = |FOR% − 50| / 50
            </p>
            <p className="text-surface-600">
              A law with 95% FOR and 10,000 votes scores much higher than one with 51% FOR and
              100 votes — even if both technically passed.
            </p>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {(Object.entries(TIER_CONFIG) as [ConsensusTier, typeof TIER_CONFIG[ConsensusTier]][]).map(([, cfg]) => (
                <div key={cfg.label} className="flex items-center gap-1.5">
                  <cfg.icon className={cn('h-3 w-3 flex-shrink-0', cfg.text)} />
                  <span className={cfg.text}>{cfg.shortLabel}</span>
                  <span className="text-surface-600 text-[10px]">— {cfg.description}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </details>

        {/* ── List ── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-20 gap-4"
            >
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30">
                <Scale className="h-5 w-5 text-against-400" />
              </div>
              <p className="text-sm font-mono text-surface-500 text-center max-w-xs">{error}</p>
              <button
                onClick={() => fetch_(category, sort)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-mono text-surface-400 bg-surface-200 border border-surface-300 rounded-lg hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </motion.div>
          ) : data && data.laws.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Gavel}
                title="No laws yet"
                description={
                  category !== 'All'
                    ? `No ${category} laws have been established yet.`
                    : 'No laws have been established yet. Keep debating!'
                }
                action={{ label: 'Browse Topics', href: '/' }}
              />
            </motion.div>
          ) : data ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2.5"
            >
              {data.laws.map((law, i) => (
                <LawCard
                  key={law.id}
                  law={law}
                  rank={i + 1}
                  maxScore={maxScore}
                />
              ))}

              {/* Footer nav */}
              <div className="flex gap-3 pt-2">
                <Link
                  href="/law"
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-mono text-surface-500 bg-surface-100 border border-surface-300 rounded-xl hover:text-white hover:bg-surface-200 transition-all"
                >
                  <Gavel className="h-3.5 w-3.5" />
                  All Laws
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/law/timeline"
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-mono text-surface-500 bg-surface-100 border border-surface-300 rounded-xl hover:text-white hover:bg-surface-200 transition-all"
                >
                  <ThumbsDown className="h-3.5 w-3.5 rotate-180" />
                  Timeline
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
