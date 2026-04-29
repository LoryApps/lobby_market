'use client'

/**
 * /observatory — The Civic Observatory
 *
 * A researcher's-eye view of Lobby Market's discourse health.
 * Shows platform-wide metrics: polarisation levels, debate quality,
 * civic vitality, category breakdowns, and 30-day activity trends.
 *
 * Distinct from /analytics (personal stats) and /pulse (live argument feed) —
 * this is the aggregate "state of the debate" from a neutral observer's lens.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  BookOpen,
  Flame,
  Gavel,
  Globe,
  MessageSquare,
  RefreshCw,
  Scale,
  Swords,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ObservatoryData, CategoryHealth, DailyActivity, PolarizationBucket } from '@/app/api/observatory/route'

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({
  label,
  score,
  description,
  color,
  icon: Icon,
}: {
  label: string
  score: number
  description: string
  color: string
  icon: typeof Activity
}) {
  const clamp = Math.max(0, Math.min(100, score))
  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-surface-100 border border-surface-200">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
        <span className="text-xs font-semibold text-surface-600 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end gap-3">
        <span className={cn('text-4xl font-bold tabular-nums leading-none', color)}>{clamp}</span>
        <span className="text-sm text-surface-500 mb-0.5">/ 100</span>
      </div>
      <div className="h-2 rounded-full bg-surface-200 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color.replace('text-', 'bg-'))}
          initial={{ width: 0 }}
          animate={{ width: `${clamp}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <p className="text-xs text-surface-500 leading-relaxed">{description}</p>
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon: Icon,
  iconClass,
  href,
}: {
  label: string
  value: string | number
  icon: typeof Activity
  iconClass: string
  href?: string
}) {
  const inner = (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 transition-colors">
      <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg bg-surface-200', iconClass)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div>
        <p className="text-lg font-bold text-white leading-none tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-xs text-surface-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>
}

// ─── Polarisation bars ────────────────────────────────────────────────────────

function PolarizationChart({ buckets }: { buckets: PolarizationBucket[] }) {
  const max = Math.max(...buckets.map(b => b.count), 1)
  return (
    <div className="space-y-2">
      {buckets.map(b => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-xs font-mono text-surface-500 w-44 shrink-0 truncate">{b.label}</span>
          <div className="flex-1 h-3 rounded-full bg-surface-200 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: b.color }}
              initial={{ width: 0 }}
              animate={{ width: `${(b.count / max) * 100}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
          <span className="text-xs font-mono text-surface-400 w-12 text-right shrink-0">
            {b.count} <span className="text-surface-600">({b.pct}%)</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Activity spark ────────────────────────────────────────────────────────────

function ActivitySpark({ data }: { data: DailyActivity[] }) {
  if (!data.length) return null
  const maxVal = Math.max(...data.map(d => d.new_topics + d.new_laws), 1)
  const W = 4
  const GAP = 1

  return (
    <div>
      <div className="flex items-end gap-px h-16" aria-hidden="true">
        {data.map((d, i) => {
          const total = d.new_topics + d.new_laws
          const h = Math.max(2, (total / maxVal) * 64)
          const topicH = total > 0 ? (d.new_topics / total) * h : 0
          const lawH = total > 0 ? (d.new_laws / total) * h : 0
          return (
            <div
              key={d.date}
              className="flex flex-col justify-end"
              style={{ width: W, marginRight: i < data.length - 1 ? GAP : 0 }}
              title={`${d.date}: ${d.new_topics} topics, ${d.new_laws} laws`}
            >
              {lawH > 0 && (
                <div className="rounded-t-sm bg-emerald" style={{ height: lawH }} />
              )}
              {topicH > 0 && (
                <div className={cn('bg-for-500', lawH === 0 && 'rounded-t-sm')} style={{ height: topicH }} />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-surface-600 font-mono">
        <span>{data[0]?.date.slice(5)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-for-500" />Topics</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-emerald" />Laws</span>
        </span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  )
}

// ─── Category health table ────────────────────────────────────────────────────

const CAT_ICONS: Record<string, string> = {
  Politics: '🗳',
  Economics: '💰',
  Technology: '⚡',
  Ethics: '⚖️',
  Science: '🔬',
  Philosophy: '🧠',
  Culture: '🎭',
  Health: '❤️',
  Environment: '🌿',
  Education: '📚',
  Other: '•',
}

function CategoryTable({ rows }: { rows: CategoryHealth[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono min-w-[540px]">
        <thead>
          <tr className="border-b border-surface-200">
            <th className="text-left text-surface-500 font-medium py-2 pr-3">Category</th>
            <th className="text-right text-surface-500 font-medium py-2 px-2">Topics</th>
            <th className="text-right text-surface-500 font-medium py-2 px-2">Laws</th>
            <th className="text-right text-surface-500 font-medium py-2 px-2 hidden sm:table-cell">→ Law %</th>
            <th className="text-right text-surface-500 font-medium py-2 px-2 hidden sm:table-cell">Avg split</th>
            <th className="text-right text-surface-500 font-medium py-2 px-2 hidden md:table-cell">Contested</th>
            <th className="text-right text-surface-500 font-medium py-2 pl-2">Args/topic</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <motion.tr
              key={r.category}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="border-b border-surface-200/60 hover:bg-surface-100/60 transition-colors"
            >
              <td className="py-2 pr-3 text-white">
                <span className="mr-1.5">{CAT_ICONS[r.category] ?? '•'}</span>
                {r.category}
              </td>
              <td className="py-2 px-2 text-right text-surface-400">{r.total_topics}</td>
              <td className="py-2 px-2 text-right text-emerald">{r.laws}</td>
              <td className="py-2 px-2 text-right text-surface-400 hidden sm:table-cell">
                {r.conversion_rate}%
              </td>
              <td className={cn('py-2 px-2 text-right hidden sm:table-cell', r.avg_blue_pct >= 50 ? 'text-for-400' : 'text-against-400')}>
                {r.avg_blue_pct}%
              </td>
              <td className="py-2 px-2 text-right text-gold hidden md:table-cell">{r.contested_pct}%</td>
              <td className="py-2 pl-2 text-right text-surface-400">{r.avg_args}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ObservatorySkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ObservatoryPage() {
  const [data, setData] = useState<ObservatoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/observatory')
      if (!res.ok) throw new Error('Failed to load observatory')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple/10 flex items-center justify-center shrink-0 mt-0.5">
                <Globe className="h-5 w-5 text-purple" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight">The Civic Observatory</h1>
                <p className="text-sm text-surface-500 mt-1 max-w-lg leading-relaxed">
                  Platform-wide health metrics — discourse quality, polarisation levels,
                  civic vitality, and 30-day trends across every debate category.
                </p>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="shrink-0 p-2 rounded-lg border border-surface-200 text-surface-500 hover:text-surface-700 hover:border-surface-300 transition-colors disabled:opacity-40"
              aria-label="Refresh observatory data"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {data && (
            <p className="text-xs text-surface-600 font-mono ml-13 pl-0.5">
              Last updated: {new Date(data.generated_at).toLocaleTimeString()}
            </p>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ObservatorySkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Swords}
                title="Observatory Offline"
                description={error}
                actions={[{ label: 'Retry', onClick: load }]}
              />
            </motion.div>
          ) : data ? (
            <motion.div
              key="data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >

              {/* ── Score gauges ──────────────────────────────────────────── */}
              <section aria-labelledby="scores-heading">
                <h2 id="scores-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Health Scores
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ScoreGauge
                    label="Civic Vitality"
                    score={data.vitality_score}
                    description="Based on recent activity: new topics, laws, and active debate rate."
                    color="text-for-400"
                    icon={Activity}
                  />
                  <ScoreGauge
                    label="Discourse Quality"
                    score={data.quality_score}
                    description="Argument density, upvote rates, and proposal conversion success."
                    color="text-emerald"
                    icon={MessageSquare}
                  />
                  <ScoreGauge
                    label="Polarisation"
                    score={data.polarization_score}
                    description="How extreme are vote splits? High = many lopsided debates, low = mostly contested."
                    color={data.polarization_score > 60 ? 'text-against-400' : data.polarization_score > 30 ? 'text-gold' : 'text-emerald'}
                    icon={Scale}
                  />
                </div>
              </section>

              {/* ── Key stats ─────────────────────────────────────────────── */}
              <section aria-labelledby="stats-heading">
                <h2 id="stats-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Platform Totals
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatTile label="Total Topics"    value={data.total_topics}    icon={BookOpen}     iconClass="text-for-400"     href="/categories" />
                  <StatTile label="Laws Established" value={data.total_laws}     icon={Gavel}        iconClass="text-emerald"     href="/law" />
                  <StatTile label="Total Votes"      value={data.total_votes}    icon={BarChart2}    iconClass="text-for-300"     href="/" />
                  <StatTile label="Total Arguments"  value={data.total_arguments} icon={MessageSquare} iconClass="text-gold"     href="/live" />
                  <StatTile label="Total Users"      value={data.total_users}    icon={Users}        iconClass="text-purple"      href="/network" />
                  <StatTile label="Active Debates"   value={data.total_active}   icon={Flame}        iconClass="text-against-300" href="/senate" />
                  <StatTile label="Avg Vote Split"   value={`${data.avg_vote_split}% FOR`} icon={Scale} iconClass="text-gold"    />
                  <StatTile label="→ Law Rate"       value={`${data.law_conversion_rate}%`} icon={TrendingUp} iconClass="text-emerald" href="/law/timeline" />
                </div>
              </section>

              {/* ── Vote split distribution ───────────────────────────────── */}
              <section aria-labelledby="polar-heading">
                <h2 id="polar-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Vote Split Distribution
                </h2>
                <div className="p-4 rounded-xl bg-surface-100 border border-surface-200">
                  <p className="text-xs text-surface-500 mb-4 leading-relaxed">
                    How do community debates distribute across the FOR/AGAINST spectrum?
                    Topics with fewer than 5 votes are excluded.
                  </p>
                  <PolarizationChart buckets={data.polarization_buckets} />
                </div>
              </section>

              {/* ── 30-day activity spark ──────────────────────────────────── */}
              <section aria-labelledby="activity-heading">
                <h2 id="activity-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  30-Day Activity
                </h2>
                <div className="p-4 rounded-xl bg-surface-100 border border-surface-200">
                  <p className="text-xs text-surface-500 mb-4 leading-relaxed">
                    New topics and laws established per day over the last 30 days.
                  </p>
                  <ActivitySpark data={data.daily_activity} />
                </div>
              </section>

              {/* ── Category health ────────────────────────────────────────── */}
              <section aria-labelledby="category-heading">
                <h2 id="category-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Category Breakdown
                </h2>
                <div className="p-4 rounded-xl bg-surface-100 border border-surface-200">
                  <p className="text-xs text-surface-500 mb-4 leading-relaxed">
                    Debate health by topic category — topics, laws passed, conversion rate,
                    average vote split, contested rate, and argument density.
                  </p>
                  <CategoryTable rows={data.category_health} />
                </div>
              </section>

              {/* ── Notable topics ──────────────────────────────────────────── */}
              {(data.most_contested_topic || data.most_unified_topic || data.highest_debate_topic) && (
                <section aria-labelledby="notable-heading">
                  <h2 id="notable-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                    Notable Topics
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {data.most_contested_topic && (
                      <Link href={`/topic/${data.most_contested_topic.id}`}>
                        <div className="p-4 rounded-xl bg-surface-100 border border-gold/30 hover:border-gold/60 transition-colors group">
                          <div className="flex items-center gap-2 mb-2">
                            <Scale className="h-3.5 w-3.5 text-gold" />
                            <span className="text-xs font-semibold text-gold uppercase tracking-wider">Most Contested</span>
                          </div>
                          <p className="text-sm text-white leading-snug line-clamp-2 mb-2">
                            {data.most_contested_topic.statement}
                          </p>
                          <p className="text-xs text-surface-400">
                            {data.most_contested_topic.blue_pct}% FOR
                            {' · '}
                            {data.most_contested_topic.total_votes.toLocaleString()} votes
                          </p>
                          <ArrowRight className="h-3 w-3 text-surface-500 group-hover:text-white mt-2 transition-colors" />
                        </div>
                      </Link>
                    )}
                    {data.most_unified_topic && (
                      <Link href={`/topic/${data.most_unified_topic.id}`}>
                        <div className="p-4 rounded-xl bg-surface-100 border border-for-500/30 hover:border-for-500/60 transition-colors group">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-3.5 w-3.5 text-for-400" />
                            <span className="text-xs font-semibold text-for-400 uppercase tracking-wider">Strongest Consensus</span>
                          </div>
                          <p className="text-sm text-white leading-snug line-clamp-2 mb-2">
                            {data.most_unified_topic.statement}
                          </p>
                          <p className="text-xs text-surface-400">
                            {data.most_unified_topic.blue_pct}% FOR
                            {' · '}
                            {data.most_unified_topic.total_votes.toLocaleString()} votes
                          </p>
                          <ArrowRight className="h-3 w-3 text-surface-500 group-hover:text-white mt-2 transition-colors" />
                        </div>
                      </Link>
                    )}
                    {data.highest_debate_topic && (
                      <Link href={`/topic/${data.highest_debate_topic.id}`}>
                        <div className="p-4 rounded-xl bg-surface-100 border border-purple/30 hover:border-purple/60 transition-colors group">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="h-3.5 w-3.5 text-purple" />
                            <span className="text-xs font-semibold text-purple uppercase tracking-wider">Most Debated</span>
                          </div>
                          <p className="text-sm text-white leading-snug line-clamp-2 mb-2">
                            {data.highest_debate_topic.statement}
                          </p>
                          <p className="text-xs text-surface-400">
                            {data.highest_debate_topic.arg_count} arguments
                            {' · '}
                            {data.highest_debate_topic.total_votes.toLocaleString()} votes
                          </p>
                          <ArrowRight className="h-3 w-3 text-surface-500 group-hover:text-white mt-2 transition-colors" />
                        </div>
                      </Link>
                    )}
                  </div>
                </section>
              )}

              {/* ── Quick links ──────────────────────────────────────────────── */}
              <section aria-labelledby="explore-heading">
                <h2 id="explore-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Explore Further
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    { href: '/spectrum',  label: 'Civic Spectrum',       sub: '2D consensus vs. engagement map',    icon: BarChart2,    color: 'text-purple' },
                    { href: '/heatmap',   label: 'Vote Heatmap',          sub: 'Category × time engagement grid',    icon: Activity,    color: 'text-gold' },
                    { href: '/shifts',    label: 'Consensus Shifts',      sub: 'How sentiment is moving',            icon: TrendingUp,  color: 'text-for-400' },
                    { href: '/graveyard', label: 'The Graveyard',         sub: 'Topics that failed to become law',   icon: XCircle,     color: 'text-against-400' },
                  ] as const).map(link => (
                    <Link key={link.href} href={link.href}>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 transition-colors group">
                        <link.icon className={cn('h-4 w-4 shrink-0', link.color)} aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{link.label}</p>
                          <p className="text-xs text-surface-500 truncate">{link.sub}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-white transition-colors shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* ── Methodology ─────────────────────────────────────────────── */}
              <div className="border border-surface-200 rounded-xl p-4">
                <p className="text-xs text-surface-500 leading-relaxed">
                  <strong className="text-surface-400">Methodology:</strong>{' '}
                  Vitality score combines recent topic creation rate and active debate ratio.
                  Quality score weights argument density, upvote rates, and proposal conversion.
                  Polarisation score measures the fraction of topics with extreme vote splits (&gt;70% one side).
                  Data refreshes in real-time with each page load.
                </p>
              </div>

            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
