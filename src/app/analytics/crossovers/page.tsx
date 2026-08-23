'use client'

/**
 * /analytics/crossovers — Civic Crossover Analysis
 *
 * Reveals where the user's votes BREAK from the platform's typical ideological
 * correlations — the moments where they think independently of the usual
 * partisan patterns.
 *
 * Bridge crossovers: Voted the SAME direction on topics that most users treat
 *   as opposites (e.g., both FOR government spending AND FOR tax cuts).
 *
 * Split crossovers: Voted DIFFERENT directions on topics that most users treat
 *   as a package (e.g., FOR climate action but AGAINST nuclear energy).
 *
 * Distinct from:
 *   /analytics/consistency  — within-category voting consistency
 *   /analytics/contrarian   — how often you go against the majority
 *   /analytics/lens         — divergence from community consensus
 *   /correlations           — platform-wide topic correlation atlas
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  ExternalLink,
  GitMerge,
  Lightbulb,
  RefreshCw,
  Scale,
  Scissors,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CrossoverData, CrossoverPair } from '@/app/api/analytics/crossovers/route'

// ─── Trait config ─────────────────────────────────────────────────────────────

const TRAIT_CONFIG = {
  bridge_builder: {
    label: 'Bridge Builder',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: GitMerge,
    desc: 'You unite ideas that most people keep apart. Your votes transcend typical ideological divisions.',
  },
  independent_thinker: {
    label: 'Independent Thinker',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Lightbulb,
    desc: 'You draw fine distinctions where most see a package deal. You reject false equivalences.',
  },
  mixed: {
    label: 'Nuanced Voter',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: Scale,
    desc: 'You bridge some divides and draw some distinctions — a balanced, case-by-case approach.',
  },
  conventional: {
    label: 'Principled Voter',
    color: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    icon: Scale,
    desc: 'Your votes align closely with typical ideological patterns. Cast more votes to reveal your crossovers.',
  },
} as const

// ─── Independence arc ─────────────────────────────────────────────────────────

function IndependenceArc({ score }: { score: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color =
    score >= 70 ? '#10b981'   // emerald
    : score >= 40 ? '#f59e0b' // gold
    : score >= 15 ? '#3b82f6' // for-blue
    : '#64748b'               // surface

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg width="112" height="112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} strokeWidth="8" fill="none" className="stroke-surface-300" />
        <circle
          cx="56" cy="56" r={r} strokeWidth="8" fill="none"
          stroke={color}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-mono font-bold text-white">{score}</span>
        <span className="text-[10px] font-mono text-surface-500 leading-none">/ 100</span>
      </div>
    </div>
  )
}

// ─── Crossover card ───────────────────────────────────────────────────────────

function CrossoverCard({ pair, type, delay }: { pair: CrossoverPair; type: 'bridge' | 'split'; delay: number }) {
  const corrPct = Math.abs(Math.round(pair.alignment_rate * 100))

  const isBridge = type === 'bridge'
  const borderColor = isBridge ? 'border-emerald/20' : 'border-gold/20'
  const iconBg = isBridge ? 'bg-emerald/10' : 'bg-gold/10'
  const iconColor = isBridge ? 'text-emerald' : 'text-gold'
  const TagIcon = isBridge ? GitMerge : Scissors

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn('rounded-2xl border bg-surface-100 p-4', borderColor)}
    >
      {/* Type badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
          <TagIcon className={cn('h-3.5 w-3.5', iconColor)} />
        </div>
        <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', iconColor)}>
          {isBridge ? 'Bridge' : 'Distinction'}
        </span>
        <span className="ml-auto text-[10px] font-mono text-surface-500">
          {corrPct}% of shared voters chose opposite
        </span>
      </div>

      {/* Topic A */}
      <div className="space-y-2">
        <TopicRow
          topicId={pair.topic_a_id}
          statement={pair.topic_a_statement}
          category={pair.topic_a_category}
          direction={pair.user_vote_a}
        />

        {/* Connector */}
        <div className="flex items-center gap-2 px-2">
          <div className="flex-1 h-px bg-surface-300" />
          <span className={cn('text-[10px] font-mono', iconColor)}>
            {isBridge ? 'both ↕' : 'split ↕'}
          </span>
          <div className="flex-1 h-px bg-surface-300" />
        </div>

        <TopicRow
          topicId={pair.topic_b_id}
          statement={pair.topic_b_statement}
          category={pair.topic_b_category}
          direction={pair.user_vote_b}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-300">
        <span className="text-[10px] font-mono text-surface-500">
          <Users className="h-3 w-3 inline mr-1" />
          {pair.shared_voters.toLocaleString()} shared voters
        </span>
        <Link
          href={`/correlations`}
          className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
        >
          See correlation <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

function TopicRow({
  topicId,
  statement,
  category,
  direction,
}: {
  topicId: string
  statement: string
  category: string | null
  direction: 'blue' | 'red'
}) {
  const isFor = direction === 'blue'
  return (
    <Link
      href={`/topic/${topicId}`}
      className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-200/60 hover:bg-surface-200 transition-colors group"
    >
      <div
        className={cn(
          'flex-shrink-0 h-6 w-6 rounded-lg flex items-center justify-center mt-0.5',
          isFor ? 'bg-for-500/20' : 'bg-against-500/20',
        )}
      >
        {isFor ? (
          <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-mono text-white leading-tight line-clamp-2 group-hover:text-for-300 transition-colors">
          {statement}
        </p>
        {category && (
          <span className="text-[10px] font-mono text-surface-500 mt-0.5 block">{category}</span>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-surface-300 bg-surface-100 px-5 py-4 gap-0.5">
      <div className={cn('text-3xl font-bold font-mono', color)}>
        <AnimatedNumber value={value} />
      </div>
      <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider text-center">{label}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrossoversPage() {
  const router = useRouter()
  const [data, setData] = useState<CrossoverData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'bridge' | 'split'>('bridge')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/crossovers', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as CrossoverData)
    } catch {
      setError('Could not load crossover data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const trait = data ? TRAIT_CONFIG[data.dominant_trait] : null
  const TraitIcon = trait?.icon ?? Scale

  const activeList = tab === 'bridge' ? (data?.bridge ?? []) : (data?.split ?? [])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
            <GitMerge className="h-5 w-5 text-emerald" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white leading-none">Crossovers</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">Where you vote beyond partisan lines</p>
          </div>
          <button
            onClick={load}
            aria-label="Refresh"
            className="ml-auto h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-40 animate-pulse" />
            <div className="grid grid-cols-3 gap-3">
              {[0,1,2].map(i => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-20 animate-pulse" />
              ))}
            </div>
            {[0,1,2].map(i => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 h-40 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={BarChart2}
            title="Couldn't load crossover data"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {/* ── Not enough votes ────────────────────────────────────────────────── */}
        {!loading && data && data.total_voted < 5 && (
          <EmptyState
            icon={Scale}
            title="Not enough votes yet"
            description={`Cast at least 5 votes to unlock your Crossover Analysis. You've voted on ${data.total_voted} topic${data.total_voted !== 1 ? 's' : ''} so far.`}
            action={{ label: 'Browse topics', href: '/' }}
          />
        )}

        {/* ── Main content ────────────────────────────────────────────────────── */}
        {!loading && data && data.total_voted >= 5 && (
          <AnimatePresence mode="wait">
            <div className="space-y-5">

              {/* Trait hero */}
              {trait && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn('rounded-2xl border p-6', trait.bg, trait.border)}
                >
                  <div className="flex items-center gap-5">
                    <IndependenceArc score={data.independence_score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <TraitIcon className={cn('h-4 w-4 flex-shrink-0', trait.color)} />
                        <span className={cn('text-xs font-mono font-semibold uppercase tracking-wider', trait.color)}>
                          Civic Independence Score
                        </span>
                      </div>
                      <div className={cn('text-xl font-mono font-bold mb-1', trait.color)}>
                        {trait.label}
                      </div>
                      <p className="text-sm font-mono text-surface-400 leading-relaxed">
                        {trait.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <StatPill label="Topics Voted" value={data.total_voted} color="text-for-400" />
                <StatPill label="Bridge Moments" value={data.bridge.length > 0 ? data.bridge.length : 0} color="text-emerald" />
                <StatPill label="Distinctions" value={data.split.length > 0 ? data.split.length : 0} color="text-gold" />
              </div>

              {/* Tab selector */}
              {(data.bridge.length > 0 || data.split.length > 0) && (
                <div className="flex rounded-xl border border-surface-300 bg-surface-100 p-1 gap-1">
                  <button
                    onClick={() => setTab('bridge')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-mono font-medium transition-all',
                      tab === 'bridge'
                        ? 'bg-emerald/20 text-emerald border border-emerald/30'
                        : 'text-surface-500 hover:text-white',
                    )}
                  >
                    <GitMerge className="h-4 w-4" />
                    Bridges
                    <Badge variant="neutral" size="sm">{data.bridge.length}</Badge>
                  </button>
                  <button
                    onClick={() => setTab('split')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-mono font-medium transition-all',
                      tab === 'split'
                        ? 'bg-gold/20 text-gold border border-gold/30'
                        : 'text-surface-500 hover:text-white',
                    )}
                  >
                    <Scissors className="h-4 w-4" />
                    Distinctions
                    <Badge variant="neutral" size="sm">{data.split.length}</Badge>
                  </button>
                </div>
              )}

              {/* Tab explainer */}
              {(data.bridge.length > 0 || data.split.length > 0) && (
                <motion.div
                  key={tab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border border-surface-300 bg-surface-100/50 px-4 py-3"
                >
                  <p className="text-xs font-mono text-surface-400 leading-relaxed">
                    {tab === 'bridge'
                      ? 'You voted the SAME direction on these topic pairs, even though the platform\'s typical voters go in opposite directions. You see a connection that most people miss.'
                      : 'You voted DIFFERENT directions on these topic pairs, even though typical voters treat them as a package. You draw fine distinctions where most people see one issue.'}
                  </p>
                </motion.div>
              )}

              {/* Crossover list */}
              {activeList.length === 0 && !loading && (
                <EmptyState
                  icon={tab === 'bridge' ? GitMerge : Scissors}
                  title={tab === 'bridge' ? 'No bridges found yet' : 'No distinctions found yet'}
                  description={
                    tab === 'bridge'
                      ? 'Vote on more topics from different categories to discover where you unite opposing ideas.'
                      : 'Vote on more topics to find where you diverge from the typical consensus-package voter.'
                  }
                  action={{ label: 'Explore topics', href: '/' }}
                />
              )}

              {activeList.map((pair, i) => (
                <CrossoverCard
                  key={`${pair.topic_a_id}-${pair.topic_b_id}`}
                  pair={pair}
                  type={tab}
                  delay={i * 0.06}
                />
              ))}

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="flex flex-wrap gap-3"
              >
                <Link
                  href="/analytics"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-sm font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <BarChart2 className="h-4 w-4" />
                  Analytics Hub
                </Link>
                <Link
                  href="/analytics/consistency"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-sm font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Scale className="h-4 w-4" />
                  Consistency Report
                </Link>
                <Link
                  href="/correlations"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-sm font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Zap className="h-4 w-4" />
                  Topic Correlations
                </Link>
                <Link
                  href="/"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-500/20 border border-for-500/40 text-sm font-mono text-for-400 hover:bg-for-500/30 transition-colors"
                >
                  Vote now
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>

            </div>
          </AnimatePresence>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
