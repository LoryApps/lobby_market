'use client'

/**
 * /analytics/lens — Civic Perspective Lens
 *
 * Shows how your vote distributions diverge from community consensus
 * by category. Answers:
 *   • Which civic topics do you see differently from the crowd?
 *   • Are you a specialist, contrarian, oracle, or maverick?
 *   • What are your most outlier individual votes?
 *
 * Distinct from:
 *   /analytics/calibration  — accuracy on RESOLVED topics (outcome-based)
 *   /analytics/evolution    — how YOUR patterns change over time
 *   /analytics/votes        — raw voting stats and timing
 *   /analytics/tags         — FOR/AGAINST split by tag
 *
 * This page focuses on LIVE divergence from community consensus.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Compass,
  ExternalLink,
  Eye,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { LensData, CategoryLens, OutlierVote, LensArchetype } from '@/app/api/analytics/lens/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
  Other:       'text-surface-500',
}

const CAT_BAR: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-400',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-400',
  Philosophy:  'bg-for-300',
  Culture:     'bg-gold',
  Health:      'bg-against-400',
  Environment: 'bg-emerald',
  Education:   'bg-purple',
  Other:       'bg-surface-400',
}

const ARCHETYPE_STYLE: Record<LensArchetype, { icon: typeof Compass; color: string; bg: string; border: string }> = {
  contrarian: { icon: TrendingDown, color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  maverick:   { icon: Sparkles,     color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30'         },
  oracle:     { icon: Eye,          color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30'       },
  specialist: { icon: BarChart2,    color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30'      },
  balanced:   { icon: Scale,        color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30'      },
  newcomer:   { icon: Zap,          color: 'text-surface-400',  bg: 'bg-surface-200',     border: 'border-surface-300'     },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LensSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0,1,2,3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-3">
          {[0,1,2,3,4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  delay = 0,
}: {
  label: string
  value: number
  sub: string
  icon: typeof Compass
  color: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
        <Icon className={cn('h-3 w-3', color)} />
        {label}
      </div>
      <div className={cn('text-3xl font-mono font-bold tabular-nums', color)}>
        <AnimatedNumber value={value} />
        <span className="text-lg text-white ml-0.5">%</span>
      </div>
      <div className="text-[10px] font-mono text-surface-500 mt-1">{sub}</div>
    </motion.div>
  )
}

function ArchetypeCard({ data }: { data: LensData }) {
  const style = ARCHETYPE_STYLE[data.lensArchetype]
  const Icon = style.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.25 }}
      className={cn('rounded-2xl border p-6', style.bg, style.border)}
    >
      <div className="flex items-start gap-4">
        <div className={cn('flex items-center justify-center h-12 w-12 rounded-xl border flex-shrink-0', style.bg, style.border)}>
          <Icon className={cn('h-6 w-6', style.color)} />
        </div>
        <div>
          <div className={cn('text-[10px] font-mono font-semibold uppercase tracking-widest mb-1', style.color)}>
            Perspective Archetype
          </div>
          <div className="text-xl font-mono font-bold text-white mb-1">{data.archetypeLabel}</div>
          <p className="text-sm font-mono text-surface-500 leading-relaxed">{data.archetypeDescription}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-100/50 border border-surface-300/50 p-3 text-center">
          <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Diversity</div>
          <div className="text-lg font-mono font-bold text-white">{data.diversityScore}%</div>
          <div className="text-[10px] font-mono text-surface-500">{data.categoriesEngaged} / 10 categories</div>
        </div>
        <div className="rounded-xl bg-surface-100/50 border border-surface-300/50 p-3 text-center">
          <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Contrarian</div>
          <div className="text-lg font-mono font-bold text-white">{data.contrarianScore}%</div>
          <div className="text-[10px] font-mono text-surface-500">of votes against majority</div>
        </div>
      </div>
    </motion.div>
  )
}

function CategoryLensTable({ categories }: { categories: CategoryLens[] }) {
  if (categories.length === 0) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.3 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
        <BarChart2 className="h-3.5 w-3.5" />
        You vs. Community — by Category
      </div>
      <div className="space-y-4">
        {categories.map((cat) => {
          const barColor = CAT_BAR[cat.category] ?? 'bg-surface-400'
          const textColor = CAT_COLOR[cat.category] ?? 'text-surface-500'
          const divergenceColor =
            cat.divergence >= 25 ? 'text-against-400' :
            cat.divergence >= 12 ? 'text-gold' : 'text-emerald'
          return (
            <div key={cat.category} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-xs font-mono font-semibold', textColor)}>{cat.category}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] font-mono text-surface-500">{cat.userVotes} vote{cat.userVotes !== 1 ? 's' : ''}</span>
                  <span className={cn('text-[10px] font-mono font-semibold', divergenceColor)}>
                    {cat.divergence > 0 ? `±${cat.divergence}pp` : 'aligned'}
                  </span>
                </div>
              </div>
              {/* Community bar */}
              <div className="relative h-2.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-surface-400/60"
                  style={{ width: `${cat.communityForPct}%` }}
                />
                <div
                  className={cn('absolute inset-y-0 left-0 rounded-full opacity-80', barColor)}
                  style={{ width: `${cat.userForPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
                <span>
                  <span className="text-white">{cat.userForPct}%</span> you FOR
                  {' · '}
                  <span className="text-surface-400">{cat.communityForPct}%</span> community FOR
                </span>
                {cat.direction !== 'aligned' && (
                  <span className={cn(
                    'text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
                    cat.direction === 'more_for'
                      ? 'bg-for-500/10 text-for-400'
                      : 'bg-against-500/10 text-against-400',
                  )}>
                    {cat.direction === 'more_for' ? '↑ more FOR' : '↓ more AGAINST'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] font-mono text-surface-500 mt-4 pt-4 border-t border-surface-300">
        Solid bar = your FOR%. Faded bar = community FOR%. Gap between them = your divergence.
      </p>
    </motion.div>
  )
}

function OutlierVotesList({ votes }: { votes: OutlierVote[] }) {
  if (votes.length === 0) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
        <TrendingDown className="h-3.5 w-3.5 text-against-400" />
        Your Most Contrarian Votes
      </div>
      <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
        Votes where your side had less than 35% community support — where you truly broke from the crowd.
      </p>
      <div className="space-y-3">
        {votes.map((v) => {
          const sidePct = v.side === 'blue' ? v.communityForPct : 100 - v.communityForPct
          const catColor = CAT_COLOR[v.category ?? 'Other'] ?? 'text-surface-500'
          const statusBadge: 'proposed' | 'active' | 'law' | 'failed' =
            v.status === 'law' ? 'law' :
            v.status === 'failed' ? 'failed' :
            v.status === 'proposed' ? 'proposed' : 'active'
          return (
            <Link
              key={v.topicId}
              href={`/topic/${v.topicId}`}
              className="flex items-start gap-3 rounded-xl p-3 bg-surface-200/50 border border-surface-300/50 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
            >
              <div className={cn(
                'flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0 mt-0.5',
                v.side === 'blue' ? 'bg-for-500/10' : 'bg-against-500/10',
              )}>
                {v.side === 'blue'
                  ? <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                  : <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-white leading-snug line-clamp-2 mb-1.5">
                  {v.statement}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {v.category && (
                    <span className={cn('text-[10px] font-mono', catColor)}>{v.category}</span>
                  )}
                  <Badge variant={statusBadge} className="text-[9px] py-0">
                    {statusBadge.charAt(0).toUpperCase() + statusBadge.slice(1)}
                  </Badge>
                  <span className="text-[10px] font-mono text-against-400">
                    only {sidePct}% agreed with you
                  </span>
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors flex-shrink-0 mt-1" />
            </Link>
          )
        })}
      </div>
    </motion.div>
  )
}

function InsightStrip({ data }: { data: LensData }) {
  const insights: { icon: typeof Compass; text: string; color: string }[] = []

  if (data.mostDivergentCategory) {
    insights.push({
      icon: TrendingDown,
      text: `You diverge most from the crowd in ${data.mostDivergentCategory}.`,
      color: 'text-against-400',
    })
  }
  if (data.mostAlignedCategory) {
    insights.push({
      icon: Users,
      text: `You're most aligned with the community in ${data.mostAlignedCategory}.`,
      color: 'text-emerald',
    })
  }
  if (data.echoScore >= 70) {
    insights.push({
      icon: Users,
      text: 'You tend to vote with the majority — an echo-chamber tendency.',
      color: 'text-for-400',
    })
  } else if (data.contrarianScore >= 50) {
    insights.push({
      icon: Sparkles,
      text: 'You frequently vote against the majority — a genuinely independent perspective.',
      color: 'text-gold',
    })
  }

  if (insights.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.4 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
        <Sparkles className="h-3.5 w-3.5 text-gold" />
        Civic Lens Insights
      </div>
      <ul className="space-y-2">
        {insights.map((ins, i) => {
          const Icon = ins.icon
          return (
            <li key={i} className="flex items-start gap-2 text-xs font-mono text-surface-600">
              <Icon className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', ins.color)} />
              {ins.text}
            </li>
          )
        })}
      </ul>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CivicLensPage() {
  const router = useRouter()
  const [data, setData] = useState<LensData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch('/api/analytics/lens')
      if (!res.ok) throw new Error('Failed to load lens data')
      const json: LensData = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white leading-tight">
              Civic Perspective Lens
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              How your votes diverge from community consensus
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center mb-6">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button onClick={load} className="text-xs font-mono text-against-400 hover:text-against-300 underline">
              Try again
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && <LensSkeleton />}

        {/* Data */}
        {!loading && data && (
          <div className="space-y-4">
            {/* Empty state */}
            {data.totalVotes < 10 && (
              <EmptyState
                icon={Compass}
                title="Not enough data yet"
                description="Cast at least 10 votes to reveal your Civic Perspective Lens."
                action={{ label: 'Go vote', href: '/' }}
              />
            )}

            {data.totalVotes >= 10 && (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Alignment"
                    value={data.alignmentScore}
                    sub="with community consensus"
                    icon={Scale}
                    color="text-for-400"
                    delay={0}
                  />
                  <StatCard
                    label="Contrarian"
                    value={data.contrarianScore}
                    sub="voted against majority"
                    icon={TrendingDown}
                    color="text-against-400"
                    delay={0.05}
                  />
                  <StatCard
                    label="Diversity"
                    value={data.diversityScore}
                    sub={`${data.categoriesEngaged}/10 categories`}
                    icon={Compass}
                    color="text-purple"
                    delay={0.1}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.15 }}
                    className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                      <BarChart2 className="h-3 w-3 text-emerald" />
                      Votes
                    </div>
                    <div className="text-3xl font-mono font-bold text-white tabular-nums">
                      <AnimatedNumber value={data.totalVotes} />
                    </div>
                    <div className="text-[10px] font-mono text-surface-500 mt-1">total topics voted on</div>
                  </motion.div>
                </div>

                <ArchetypeCard data={data} />
                <InsightStrip data={data} />
                <CategoryLensTable categories={data.byCategory} />
                {data.outlierVotes.length > 0 && <OutlierVotesList votes={data.outlierVotes} />}

                {/* CTA */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.45 }}
                  className="rounded-2xl border border-for-500/20 bg-for-500/5 p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-for-400" />
                    <span className="text-xs font-mono font-semibold text-for-400 uppercase tracking-wider">
                      Explore More
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Link
                      href="/analytics/calibration"
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-surface-300 hover:border-surface-400 hover:bg-surface-200/50 transition-colors text-xs font-mono text-surface-600"
                    >
                      <Gavel className="h-3.5 w-3.5 text-purple flex-shrink-0" />
                      Calibration Report →
                    </Link>
                    <Link
                      href="/analytics/evolution"
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-surface-300 hover:border-surface-400 hover:bg-surface-200/50 transition-colors text-xs font-mono text-surface-600"
                    >
                      <TrendingUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                      Opinion Evolution →
                    </Link>
                    <Link
                      href="/analytics/tags"
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-surface-300 hover:border-surface-400 hover:bg-surface-200/50 transition-colors text-xs font-mono text-surface-600"
                    >
                      <BarChart2 className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
                      Tag Voting Profile →
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-surface-300 hover:border-surface-400 hover:bg-surface-200/50 transition-colors text-xs font-mono text-surface-600"
                    >
                      <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                      Vote on more topics →
                    </Link>
                  </div>
                </motion.div>
              </>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
