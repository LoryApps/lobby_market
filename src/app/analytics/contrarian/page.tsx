'use client'

/**
 * /analytics/contrarian — The Contrarian Deep Dive
 *
 * A dedicated breakdown of how often — and how fiercely — you vote against
 * community consensus. Shows your contrarian score, archetype, category
 * heatmap, longest contrarian streak, and the specific topics where you
 * went furthest against the grain.
 *
 * Distinct from:
 *   /analytics/drift          — overall alignment/drift across all votes
 *   /analytics/consistency    — voting patterns within categories
 *   /analytics/calibration    — prediction accuracy
 *   /fingerprint              — how unique your profile is vs. median voter
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ExternalLink,
  Flame,
  RefreshCw,
  Scale,
  Shuffle,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  ContrarianResponse,
  ContrarianTopic,
  ContrarianCategoryStat,
  ContrarianArchetype,
} from '@/app/api/analytics/contrarian/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const ARCHETYPE_STYLE: Record<
  ContrarianArchetype,
  { color: string; bg: string; border: string; glow: string }
> = {
  lone_wolf:           { color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]' },
  principled_dissenter:{ color: 'text-gold',         bg: 'bg-gold/10',        border: 'border-gold/30',        glow: 'shadow-[0_0_20px_rgba(201,168,76,0.15)]' },
  selective_rebel:     { color: 'text-purple',       bg: 'bg-purple/10',      border: 'border-purple/30',      glow: 'shadow-[0_0_20px_rgba(139,92,246,0.15)]' },
  devils_advocate:     { color: 'text-for-300',      bg: 'bg-for-400/10',     border: 'border-for-400/30',     glow: 'shadow-[0_0_20px_rgba(96,165,250,0.15)]' },
  mainstream_voter:    { color: 'text-emerald',      bg: 'bg-emerald/10',     border: 'border-emerald/30',     glow: '' },
  true_believer:       { color: 'text-for-400',      bg: 'bg-for-500/10',     border: 'border-for-500/30',     glow: '' },
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}
const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  sub,
  icon: Icon,
  color,
  delay = 0,
}: {
  label: string
  value: number | string
  sub: string
  icon: typeof TrendingUp
  color: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div className="flex items-end gap-1">
        {typeof value === 'number' ? (
          <AnimatedNumber
            value={value}
            className={cn('text-2xl font-mono font-bold', color)}
          />
        ) : (
          <span className={cn('text-2xl font-mono font-bold', color)}>{value}</span>
        )}
      </div>
      <p className="text-[11px] font-mono text-surface-500">{sub}</p>
    </motion.div>
  )
}

function ContrarianMeter({ pct }: { pct: number }) {
  const width = `${Math.min(100, pct)}%`
  const color =
    pct >= 50 ? 'bg-against-500' : pct >= 30 ? 'bg-gold' : pct >= 15 ? 'bg-purple' : 'bg-for-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-surface-500">Consensus voter</span>
        <span className="text-surface-500">Lone wolf</span>
      </div>
      <div className="h-3 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
      <div className="flex justify-center">
        <span className="text-xs font-mono font-bold text-white">{pct}% contrarian rate</span>
      </div>
    </div>
  )
}

function CategoryBar({ stat }: { stat: ContrarianCategoryStat }) {
  const width = `${stat.contrarian_pct}%`
  const barColor =
    stat.contrarian_pct >= 60
      ? 'bg-against-500'
      : stat.contrarian_pct >= 40
        ? 'bg-gold'
        : stat.contrarian_pct >= 25
          ? 'bg-purple'
          : 'bg-for-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-white font-semibold truncate max-w-[140px]">{stat.category}</span>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-surface-500">{stat.contrarian}/{stat.total}</span>
          <span className={cn(
            'font-bold',
            stat.contrarian_pct >= 60 ? 'text-against-400' :
            stat.contrarian_pct >= 40 ? 'text-gold' :
            stat.contrarian_pct >= 25 ? 'text-purple' : 'text-emerald'
          )}>
            {stat.contrarian_pct}%
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', barColor)}
        />
      </div>
    </div>
  )
}

function TopicRow({ topic, index }: { topic: ContrarianTopic; index: number }) {
  const forPct = Math.round(topic.blue_pct)
  const isFor = topic.user_vote === 'blue'
  const agreePct = isFor ? forPct : 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
    >
      {/* Gap badge */}
      <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-against-500/10 border border-against-500/30 mt-0.5">
        <span className="text-[11px] font-mono font-bold text-against-400">-{topic.gap}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">
            {STATUS_LABEL[topic.status] ?? topic.status}
          </Badge>
          {topic.category && (
            <span className="text-[11px] font-mono text-surface-500">{topic.category}</span>
          )}
          <span
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold',
              isFor
                ? 'bg-for-500/20 text-for-300 border border-for-500/30'
                : 'bg-against-500/20 text-against-300 border border-against-500/30'
            )}
          >
            {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
        </div>

        <Link href={`/topic/${topic.topic_id}`}>
          <p className="text-sm font-mono font-semibold text-white leading-snug hover:text-for-300 transition-colors line-clamp-2">
            {topic.statement}
          </p>
        </Link>

        <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono text-surface-500">
          <span>
            Only <span className="text-against-400 font-semibold">{agreePct}%</span> agreed with you
          </span>
          <span>·</span>
          <span>{topic.total_votes.toLocaleString()} votes</span>
        </div>
      </div>

      <Link
        href={`/topic/${topic.topic_id}`}
        aria-label={`View topic: ${topic.statement}`}
        className="flex-shrink-0 mt-0.5 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </motion.div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Archetype card */}
      <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        {[0,1,2,3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* Category bars */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-36" />
        {[0,1,2,3,4].map((i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ContrarianPage() {
  const router = useRouter()
  const [data, setData] = useState<ContrarianResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/contrarian', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const archetypeStyle = data ? ARCHETYPE_STYLE[data.archetype] : ARCHETYPE_STYLE.mainstream_voter
  const winRate = data && data.resolved_contrarian_total > 0
    ? Math.round((data.resolved_contrarian_wins / data.resolved_contrarian_total) * 100)
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Shuffle className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">Contrarian Deep Dive</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">How often you vote against community consensus</p>
            </div>
          </div>
          {!loading && (
            <button
              onClick={load}
              aria-label="Refresh"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-5 text-center mb-6">
            <p className="text-sm font-mono text-against-300 mb-3">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600 text-white text-xs font-mono hover:bg-for-700 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Empty state */}
              {data.total_voted < 5 && (
                <EmptyState
                  icon={Scale}
                  title="Not enough votes yet"
                  description="Cast at least 5 votes to see your contrarian profile."
                  actions={[{ label: 'Browse feed', href: '/', variant: 'primary' }]}
                  size="md"
                />
              )}

              {data.total_voted >= 5 && (
                <>
                  {/* Archetype card */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    className={cn(
                      'rounded-3xl border p-6 space-y-4',
                      archetypeStyle.bg,
                      archetypeStyle.border,
                      archetypeStyle.glow
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-2xl border',
                        archetypeStyle.bg, archetypeStyle.border
                      )}>
                        <Shuffle className={cn('h-6 w-6', archetypeStyle.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-[11px] font-mono font-semibold uppercase tracking-wider mb-1', archetypeStyle.color)}>
                          Your Contrarian Archetype
                        </p>
                        <h2 className="font-mono text-xl font-bold text-white leading-snug">
                          {data.archetype_label}
                        </h2>
                        <p className="text-sm font-mono text-surface-300 leading-relaxed mt-1">
                          {data.archetype_description}
                        </p>
                      </div>
                    </div>

                    {/* Meter */}
                    <ContrarianMeter pct={data.contrarian_pct} />
                  </motion.div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <StatBox
                      label="Contrarian Votes"
                      value={data.contrarian_count}
                      sub={`of ${data.total_voted} total votes`}
                      icon={Shuffle}
                      color="text-against-400"
                      delay={0.05}
                    />
                    <StatBox
                      label="Avg. Consensus Gap"
                      value={data.avg_gap}
                      sub="points below agreement"
                      icon={TrendingDown}
                      color="text-gold"
                      delay={0.1}
                    />
                    <StatBox
                      label="Contrarian Streak"
                      value={data.current_streak}
                      sub={`longest: ${data.longest_streak}`}
                      icon={Flame}
                      color="text-against-400"
                      delay={0.15}
                    />
                    {winRate !== null ? (
                      <StatBox
                        label="Contrarian Win Rate"
                        value={`${winRate}%`}
                        sub={`${data.resolved_contrarian_wins}/${data.resolved_contrarian_total} resolved`}
                        icon={Trophy}
                        color={winRate >= 50 ? 'text-emerald' : 'text-against-400'}
                        delay={0.2}
                      />
                    ) : (
                      <StatBox
                        label="Total Voted"
                        value={data.total_voted}
                        sub="topics across all categories"
                        icon={BarChart2}
                        color="text-for-400"
                        delay={0.2}
                      />
                    )}
                  </div>

                  {/* Category heatmap */}
                  {data.category_stats.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.25 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
                    >
                      <div className="flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-surface-500" />
                        <h3 className="text-sm font-mono font-semibold text-white">Contrarian Rate by Category</h3>
                      </div>

                      <div className="space-y-3">
                        {data.category_stats.slice(0, 10).map((stat) => (
                          <CategoryBar key={stat.category} stat={stat} />
                        ))}
                      </div>

                      {(data.most_contrarian_category || data.least_contrarian_category) && (
                        <div className="flex gap-3 pt-1">
                          {data.most_contrarian_category && (
                            <div className="flex-1 rounded-xl bg-against-500/10 border border-against-500/20 px-3 py-2">
                              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">Most contrarian</p>
                              <p className="text-xs font-mono font-semibold text-against-300">{data.most_contrarian_category}</p>
                            </div>
                          )}
                          {data.least_contrarian_category && data.least_contrarian_category !== data.most_contrarian_category && (
                            <div className="flex-1 rounded-xl bg-emerald/10 border border-emerald/20 px-3 py-2">
                              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">Most aligned</p>
                              <p className="text-xs font-mono font-semibold text-emerald">{data.least_contrarian_category}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Contrarian win rate callout */}
                  {winRate !== null && data.resolved_contrarian_total >= 3 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                      className={cn(
                        'rounded-2xl border p-4 flex items-start gap-3',
                        winRate >= 50
                          ? 'bg-emerald/10 border-emerald/30'
                          : 'bg-against-500/10 border-against-500/30'
                      )}
                    >
                      <div className={cn(
                        'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border mt-0.5',
                        winRate >= 50 ? 'bg-emerald/10 border-emerald/30' : 'bg-against-500/10 border-against-500/30'
                      )}>
                        {winRate >= 50
                          ? <TrendingUp className="h-4 w-4 text-emerald" />
                          : <TrendingDown className="h-4 w-4 text-against-400" />
                        }
                      </div>
                      <div>
                        <p className={cn('text-sm font-mono font-semibold', winRate >= 50 ? 'text-emerald' : 'text-against-300')}>
                          {winRate >= 50 ? 'Your contrarian bets pay off' : 'The consensus usually wins'}
                        </p>
                        <p className="text-xs font-mono text-surface-500 mt-0.5 leading-relaxed">
                          {winRate >= 50
                            ? `${winRate}% of your contrarian votes on resolved topics ended up correct — you have good instincts.`
                            : `${winRate}% win rate on resolved contrarian bets. The community tends to be right, but outliers shape history.`
                          }
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Top contrarian topics */}
                  {data.top_contrarian.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.35 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2 px-1">
                        <Zap className="h-3.5 w-3.5 text-surface-500" />
                        <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                          Your most contrarian votes
                        </h3>
                      </div>
                      {data.top_contrarian.map((topic, i) => (
                        <TopicRow key={topic.topic_id} topic={topic} index={i} />
                      ))}
                    </motion.div>
                  )}

                  {/* Footer nav */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="grid grid-cols-2 gap-3"
                  >
                    <Link
                      href="/analytics/drift"
                      className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                    >
                      <div>
                        <p className="text-xs font-mono font-semibold text-white">Opinion Drift</p>
                        <p className="text-[11px] font-mono text-surface-500">Full alignment overview</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                    </Link>
                    <Link
                      href="/analytics/consistency"
                      className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                    >
                      <div>
                        <p className="text-xs font-mono font-semibold text-white">Consistency</p>
                        <p className="text-[11px] font-mono text-surface-500">Category patterns</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                    </Link>
                  </motion.div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
