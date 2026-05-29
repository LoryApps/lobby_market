'use client'

/**
 * /blindspots — Civic Blind Spots
 *
 * Reveals the civic categories the user has NEVER engaged with — the debates
 * they've been skipping, the ideas they haven't considered, the communities
 * whose voices they haven't heard.
 *
 * Goal: encourage genuinely broad civic participation. Not just your echo
 * chamber, but the full spectrum of democratic discourse.
 *
 * Distinct from:
 *   /diversity      — measures HOW EVENLY you vote (entropy score)
 *   /fingerprint    — shows WHERE you deviate from consensus
 *   /recommended    — algorithmic recommendations based on engagement
 *   /analytics      — general performance stats
 *
 * Blind Spots specifically answers: "Which civic battles have you been
 * ignoring entirely — and what would you find if you looked?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  Brain,
  CheckCircle2,
  Compass,
  Cpu,
  Eye,
  EyeOff,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { BlindSpotsResponse, CategoryCoverage } from '@/app/api/analytics/blindspots/route'
import type { BlindSpotTopic } from '@/app/api/analytics/blindspots/route'

// ─── Category Config ──────────────────────────────────────────────────────────

type CategoryIconType = typeof Globe

const CATEGORY_CONFIG: Record<string, {
  icon: CategoryIconType
  color: string
  bg: string
  border: string
}> = {
  Politics:    { icon: Landmark,      color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30'      },
  Economics:   { icon: TrendingUp,    color: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/30'          },
  Technology:  { icon: Cpu,           color: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30'        },
  Science:     { icon: FlaskConical,  color: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30'       },
  Ethics:      { icon: Scale,         color: 'text-against-400',  bg: 'bg-against-500/10',   border: 'border-against-500/30'   },
  Philosophy:  { icon: Brain,         color: 'text-indigo-400',   bg: 'bg-indigo-400/10',    border: 'border-indigo-400/30'    },
  Culture:     { icon: Music2,        color: 'text-orange-400',   bg: 'bg-orange-400/10',    border: 'border-orange-400/30'    },
  Health:      { icon: Heart,         color: 'text-pink-400',     bg: 'bg-pink-400/10',      border: 'border-pink-400/30'      },
  Environment: { icon: Leaf,          color: 'text-green-400',    bg: 'bg-green-400/10',     border: 'border-green-400/30'     },
  Education:   { icon: GraduationCap, color: 'text-cyan-400',     bg: 'bg-cyan-400/10',      border: 'border-cyan-400/30'      },
}

function getConfig(cat: string) {
  return CATEGORY_CONFIG[cat] ?? {
    icon: Globe,
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    hex: '#71717a',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed' | 'default'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

function topicStatusLabel(status: string): string {
  const map: Record<string, string> = {
    proposed: 'Proposed',
    active:   'Active',
    voting:   'Voting',
    law:      'Law',
    failed:   'Failed',
  }
  return map[status] ?? status
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BlindSpotsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Coverage meter */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-4 w-40 mb-3" />
        <Skeleton className="h-3 w-full rounded-full mb-2" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      {/* Challenge card */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>
      {/* Category grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-7 w-7 rounded-lg mb-3" />
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Topic mini-card ──────────────────────────────────────────────────────────

function TopicCard({ topic }: { topic: BlindSpotTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block p-3 rounded-xl border bg-surface-200/50 transition-all',
        'hover:bg-surface-200 hover:border-surface-400',
        'border-surface-300',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge
          variant={STATUS_BADGE[topic.status] ?? 'default'}
          className="text-[10px] shrink-0"
        >
          {topicStatusLabel(topic.status)}
        </Badge>
        {topic.total_votes > 0 && (
          <span className="text-[10px] font-mono text-surface-500 shrink-0">
            {topic.total_votes.toLocaleString()}v
          </span>
        )}
      </div>
      <p className="text-xs font-mono text-white leading-snug line-clamp-2 mb-2">
        {topic.statement}
      </p>
      {topic.total_votes > 0 && (
        <div className="space-y-1">
          <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400 transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-for-400 flex items-center gap-0.5">
              <ThumbsUp className="h-2.5 w-2.5" />
              {forPct}%
            </span>
            <span className="text-against-400 flex items-center gap-0.5">
              {againstPct}%
              <ThumbsDown className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      )}
    </Link>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryCoverage }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = getConfig(cat.category)
  const Icon = cfg.icon

  const isBlind  = cat.is_blind_spot
  const isThin   = cat.is_thin
  const isCovered = !isBlind && !isThin

  let statusLabel: string
  let statusClass: string
  if (isBlind)    { statusLabel = 'Blind spot'; statusClass = 'text-against-400' }
  else if (isThin) { statusLabel = `${cat.vote_count} votes`; statusClass = 'text-surface-500' }
  else             { statusLabel = `${cat.vote_count} votes`; statusClass = 'text-emerald' }

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border transition-all',
        isBlind
          ? 'bg-surface-100/80 border-against-500/20'
          : isThin
          ? 'bg-surface-100/80 border-gold/20'
          : 'bg-surface-100/60 border-surface-300',
      )}
    >
      {/* Header */}
      <button
        className="w-full text-left p-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-xl flex-shrink-0', cfg.bg, cfg.border, 'border')}>
            <Icon className={cn('h-4 w-4', cfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-mono font-bold text-white">
                {cat.category}
              </span>
              {isBlind && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-against-400">
                  <EyeOff className="h-3 w-3" />
                  Never voted
                </span>
              )}
              {isCovered && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
              )}
            </div>
            <p className={cn('text-xs font-mono', statusClass)}>{statusLabel}</p>
          </div>
          {cat.topics.length > 0 && (
            <ArrowRight
              className={cn(
                'h-4 w-4 text-surface-500 flex-shrink-0 transition-transform mt-1',
                expanded && 'rotate-90',
              )}
            />
          )}
        </div>
      </button>

      {/* Expanded topics */}
      <AnimatePresence initial={false}>
        {expanded && cat.topics.length > 0 && (
          <motion.div
            key="topics"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                Active debates in {cat.category}
              </p>
              {cat.topics.map((t) => (
                <TopicCard key={t.id} topic={t} />
              ))}
              <Link
                href={`/categories/${cat.category}`}
                className={cn(
                  'flex items-center justify-center gap-1.5 w-full mt-2 py-2 rounded-xl',
                  'text-xs font-mono border transition-all',
                  cfg.bg, cfg.border, cfg.color,
                  'hover:opacity-80',
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Browse all {cat.category} debates
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function BlindSpotsClient() {
  const router = useRouter()
  const [data, setData] = useState<BlindSpotsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/analytics/blindspots')
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const blindSpots = data?.coverage.filter((c) => c.is_blind_spot) ?? []
  const thinSpots  = data?.coverage.filter((c) => c.is_thin) ?? []
  const covered    = data?.coverage.filter((c) => !c.is_blind_spot && !c.is_thin) ?? []

  const coveragePct = data?.coverage_pct ?? 0

  // Coverage bar colour
  let barColor = 'bg-against-500'
  if (coveragePct >= 70) barColor = 'bg-emerald'
  else if (coveragePct >= 40) barColor = 'bg-gold'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        {/* ── Nav ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
            <EyeOff className="h-6 w-6 text-against-400" />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold text-white mb-1">
              Civic Blind Spots
            </h1>
            <p className="text-sm font-mono text-surface-500 leading-relaxed">
              The categories you&rsquo;ve been skipping. Every ignored debate is a voice you haven&rsquo;t heard.
            </p>
          </div>
        </div>

        {loading ? (
          <BlindSpotsSkeleton />
        ) : !data ? (
          <EmptyState
            icon={Globe}
            title="Could not load blind spots"
            description="Try refreshing the page."
          />
        ) : (
          <div className="space-y-8">
            {/* ── Coverage Meter ─────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-surface-500" />
                  <span className="text-sm font-mono font-bold text-white">
                    Civic Coverage
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-white tabular-nums">
                  {data.covered_count}/{data.total_categories} categories
                </span>
              </div>

              <div className="h-3 rounded-full bg-surface-300 overflow-hidden mb-2">
                <motion.div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  initial={{ width: 0 }}
                  animate={{ width: `${coveragePct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-surface-500">
                <span>{coveragePct}% coverage</span>
                <span>
                  {blindSpots.length > 0
                    ? `${blindSpots.length} blind spot${blindSpots.length !== 1 ? 's' : ''}`
                    : 'Full coverage!'}
                </span>
              </div>

              {/* Coverage label */}
              <div className="mt-4 flex items-center gap-2">
                {coveragePct === 100 ? (
                  <div className="flex items-center gap-2 text-emerald">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-mono font-semibold">
                      Full civic coverage — you&rsquo;ve engaged with every category!
                    </span>
                  </div>
                ) : coveragePct >= 70 ? (
                  <div className="flex items-center gap-2 text-gold">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-mono">
                      Strong coverage. A few more categories to unlock full civic breadth.
                    </span>
                  </div>
                ) : coveragePct >= 40 ? (
                  <div className="flex items-center gap-2 text-surface-400">
                    <Info className="h-4 w-4" />
                    <span className="text-sm font-mono">
                      Moderate coverage. You&rsquo;re missing more than half the civic landscape.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-against-400">
                    <EyeOff className="h-4 w-4" />
                    <span className="text-sm font-mono">
                      {data.authenticated
                        ? 'Most of the civic landscape is unexplored territory.'
                        : 'Sign in to see your personal civic coverage.'}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* ── Today's Challenge ────────────────────────────────────────── */}
            {data.challenge_topic && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-against-500/5 border border-against-500/20 p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-4 w-4 text-against-400" />
                  <span className="text-sm font-mono font-bold text-against-400 uppercase tracking-wider">
                    Today&rsquo;s Blind Spot Challenge
                  </span>
                </div>

                <p className="text-[11px] font-mono text-surface-500 mb-2">
                  You&rsquo;ve never voted in{' '}
                  <span className="text-white font-semibold">{data.challenge_topic.category}</span>.
                  Start here:
                </p>

                <p className="text-base font-mono font-bold text-white leading-snug mb-4">
                  {data.challenge_topic.statement}
                </p>

                <div className="flex flex-wrap gap-2 items-center">
                  <Link
                    href={`/topic/${data.challenge_topic.id}`}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl',
                      'bg-against-500 hover:bg-against-400 transition-colors',
                      'text-sm font-mono font-bold text-white',
                    )}
                  >
                    <Compass className="h-4 w-4" />
                    Explore this debate
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {data.challenge_topic.category && (
                    <Link
                      href={`/categories/${data.challenge_topic.category}`}
                      className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      Browse all {data.challenge_topic.category} →
                    </Link>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Blind Spots Section ──────────────────────────────────────── */}
            {blindSpots.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <EyeOff className="h-4 w-4 text-against-400" />
                  <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                    True Blind Spots
                  </h2>
                  <span className="text-xs font-mono text-against-400 ml-1">
                    — never voted
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
                  These categories have zero votes from you. Click any card to discover what&rsquo;s being debated there.
                </p>
                <div className="space-y-3">
                  {blindSpots.map((cat, i) => (
                    <motion.div
                      key={cat.category}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <CategoryCard cat={cat} />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ── Thin Coverage Section ────────────────────────────────────── */}
            {thinSpots.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                    Thin Coverage
                  </h2>
                  <span className="text-xs font-mono text-gold ml-1">
                    — fewer than 5 votes
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
                  You&rsquo;ve dipped into these categories but haven&rsquo;t gone deep. There&rsquo;s more to explore.
                </p>
                <div className="space-y-3">
                  {thinSpots.map((cat, i) => (
                    <motion.div
                      key={cat.category}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <CategoryCard cat={cat} />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ── Well Covered Section ────────────────────────────────────── */}
            {covered.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-4 w-4 text-emerald" />
                  <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                    Well Covered
                  </h2>
                  <span className="text-xs font-mono text-emerald ml-1">
                    — 5+ votes
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {covered.map((cat) => {
                    const cfg = getConfig(cat.category)
                    const Icon = cfg.icon
                    return (
                      <Link
                        key={cat.category}
                        href={`/categories/${cat.category}`}
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-xl border transition-all',
                          'bg-surface-100/50 border-surface-300 hover:border-emerald/30 hover:bg-emerald/5',
                        )}
                      >
                        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', cfg.color)} />
                        <span className="text-xs font-mono text-surface-400 truncate">
                          {cat.category}
                        </span>
                        <span className="text-[10px] font-mono text-emerald ml-auto flex-shrink-0">
                          {cat.vote_count}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </motion.section>
            )}

            {/* ── Empty state: perfect coverage ───────────────────────────── */}
            {blindSpots.length === 0 && thinSpots.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-emerald/5 border border-emerald/20 p-8 text-center"
              >
                <CheckCircle2 className="h-10 w-10 text-emerald mx-auto mb-3" />
                <h3 className="text-lg font-mono font-bold text-white mb-2">
                  No blind spots!
                </h3>
                <p className="text-sm font-mono text-surface-500">
                  You&rsquo;ve engaged with every civic category. Your perspective spans the full democratic landscape.
                </p>
              </motion.div>
            )}

            {/* ── Footer CTAs ─────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="pt-4 border-t border-surface-300 flex flex-wrap gap-3"
            >
              <Link
                href="/diversity"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Diversity score
              </Link>
              <Link
                href="/recommended"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Recommended topics
              </Link>
              <Link
                href="/categories"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-500/10 border border-for-500/30 text-xs font-mono text-for-400 hover:bg-for-500/20 transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Browse categories
              </Link>
            </motion.div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
