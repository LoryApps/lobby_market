'use client'

/**
 * /intelligence — The Civic Intelligence Center
 *
 * A weekly AI-curated briefing on platform-wide civic health:
 * consensus velocity, contested debates, belief shifts, law pipeline,
 * category heat, and rising voices.
 *
 * Distinct from:
 *   /signals     — real-time power-user dashboard
 *   /vitals      — platform health metrics
 *   /digest      — editorial weekly roundup
 *   /trending    — what's hot right now
 *   /gazette     — daily civic front page
 *
 * The Intelligence Center is narrative + data: it reads the patterns
 * behind the numbers and surfaces what they mean for civic discourse.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Brain,
  ChevronRight,
  Eye,
  Flame,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  PlatformIntelligence,
  VelocityTopic,
  LawPipelineTopic,
  CategoryIntelligence,
} from '@/app/api/intelligence/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    person: 'Citizen',
    debator: 'Debator',
    troll_catcher: 'Troll Catcher',
    elder: 'Elder',
    senator: 'Senator',
    lawmaker: 'Lawmaker',
  }
  return map[role] ?? role
}

function roleBadgeClass(role: string): string {
  const map: Record<string, string> = {
    elder:        'border-gold/40 text-gold bg-gold/10',
    senator:      'border-purple/40 text-purple bg-purple/10',
    lawmaker:     'border-gold/50 text-gold bg-gold/15',
    debator:      'border-for-500/40 text-for-300 bg-for-500/10',
    troll_catcher:'border-emerald/40 text-emerald bg-emerald/10',
    person:       'border-surface-400 text-surface-500 bg-surface-300/20',
  }
  return map[role] ?? 'border-surface-400 text-surface-500 bg-surface-300/20'
}

// ─── Index gauge ──────────────────────────────────────────────────────────────

function IndexGauge({ score, label, delta }: { score: number; label: string; delta: number }) {
  const color =
    score >= 80 ? 'text-gold' :
    score >= 60 ? 'text-emerald' :
    score >= 40 ? 'text-for-400' :
    'text-surface-500'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center h-28 w-28">
        <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#1e2030" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeDasharray={`${Math.PI * 100 * score / 100} ${Math.PI * 100}`}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <div className="text-center z-10">
          <div className={cn('text-3xl font-black font-mono tabular-nums', color)}>{score}</div>
          <div className="text-[10px] text-surface-500 font-mono uppercase tracking-wider">/ 100</div>
        </div>
      </div>
      <div>
        <div className={cn('text-sm font-bold text-center', color)}>{label}</div>
        <div className={cn(
          'flex items-center gap-0.5 justify-center text-[11px] font-mono',
          delta > 0 ? 'text-emerald' : delta < 0 ? 'text-against-400' : 'text-surface-500'
        )}>
          {delta > 0 ? <ArrowUp className="h-3 w-3" /> : delta < 0 ? <ArrowDown className="h-3 w-3" /> : null}
          {delta !== 0 ? `${Math.abs(delta)} pts vs last week` : 'No change from last week'}
        </div>
      </div>
    </div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function MiniVoteBar({ bluePct, className }: { bluePct: number; className?: string }) {
  const red = 100 - bluePct
  return (
    <div className={cn('flex h-1.5 rounded-full overflow-hidden', className)}>
      <div className="bg-for-500 transition-all duration-500" style={{ width: `${bluePct}%` }} />
      <div className="bg-against-500 transition-all duration-500" style={{ width: `${red}%` }} />
    </div>
  )
}

// ─── Velocity leader card ─────────────────────────────────────────────────────

function VelocityCard({ topic, rank }: { topic: VelocityTopic; rank: number }) {
  const TrendIcon = topic.trend_direction === 'rising' ? TrendingUp : topic.trend_direction === 'falling' ? TrendingDown : Activity
  const trendColor = topic.trend_direction === 'rising' ? 'text-emerald' : topic.trend_direction === 'falling' ? 'text-against-400' : 'text-surface-500'

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group flex items-start gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-surface-400/60 hover:bg-surface-200 transition-all"
    >
      <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-surface-300/60 text-surface-500 text-xs font-mono font-bold">
        {rank}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-xs font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {topic.statement}
        </p>
        <MiniVoteBar bluePct={topic.blue_pct} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-for-400">{Math.round(topic.blue_pct)}% FOR</span>
            {topic.category && (
              <span className="text-[10px] text-surface-500">{topic.category}</span>
            )}
          </div>
          <div className={cn('flex items-center gap-1 text-[10px] font-mono', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {topic.trend_direction}
          </div>
        </div>
        {topic.days_until_threshold !== null && (
          <p className="text-[10px] text-gold font-mono">
            ~{topic.days_until_threshold}d until threshold
          </p>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-xs font-black font-mono text-purple">{Math.round(topic.momentum_score)}</div>
        <div className="text-[9px] text-surface-500">momentum</div>
      </div>
    </Link>
  )
}

// ─── Pipeline card ────────────────────────────────────────────────────────────

function PipelineCard({ topic }: { topic: LawPipelineTopic }) {
  const scoreColor =
    topic.pipeline_score >= 70 ? 'text-gold border-gold/40 bg-gold/10' :
    topic.pipeline_score >= 40 ? 'text-emerald border-emerald/40 bg-emerald/10' :
    'text-for-400 border-for-500/30 bg-for-500/10'

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group flex items-start gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-gold/30 hover:bg-surface-200 transition-all"
    >
      <div className={cn(
        'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border text-sm font-black font-mono',
        scoreColor
      )}>
        {topic.pipeline_score}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-xs font-medium text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors">
          {topic.statement}
        </p>
        <MiniVoteBar bluePct={topic.blue_pct} />
        <div className="flex items-center gap-3 text-[10px]">
          <span className="font-mono text-for-400">{Math.round(topic.blue_pct)}% FOR</span>
          <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
          {topic.votes_needed > 0 && (
            <span className="text-gold font-mono">+{topic.votes_needed} FOR needed</span>
          )}
        </div>
        {topic.blockers.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {topic.blockers.map((b) => (
              <span key={b} className="text-[9px] px-1.5 py-0.5 rounded-md bg-against-500/10 text-against-400 border border-against-500/20">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
      <Gavel className="h-4 w-4 text-gold/60 flex-shrink-0 mt-0.5" />
    </Link>
  )
}

// ─── Category heat row ────────────────────────────────────────────────────────

function CategoryHeatRow({ cat }: { cat: CategoryIntelligence }) {
  const heatColor =
    cat.vote_velocity > 500 ? 'bg-against-500' :
    cat.vote_velocity > 200 ? 'bg-for-500' :
    cat.vote_velocity > 50 ? 'bg-purple' :
    'bg-surface-400'

  const maxVelocity = 1000
  const barPct = Math.min(100, (cat.vote_velocity / maxVelocity) * 100)

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 flex-shrink-0">
        <p className="text-[11px] text-surface-700 truncate">{cat.category}</p>
      </div>
      <div className="flex-1 h-2 bg-surface-300/60 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', heatColor)}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <div className="w-16 flex-shrink-0 text-right">
        <span className="text-[11px] font-mono text-surface-500">
          {cat.topic_count} topics
        </span>
      </div>
      {cat.law_count > 0 && (
        <div className="flex-shrink-0">
          <span className="text-[10px] font-mono text-gold bg-gold/10 border border-gold/30 rounded-md px-1.5 py-0.5">
            {cat.law_count} laws
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  subtitle,
  iconClass = 'text-for-400',
  children,
}: {
  icon: typeof Brain
  title: string
  subtitle?: string
  iconClass?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-xl bg-surface-200 border border-surface-300', iconClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          {subtitle && <p className="text-[11px] text-surface-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function IntelligenceSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-4 py-4">
        <Skeleton className="h-28 w-28 rounded-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-4 w-40" />
          </div>
          {[0, 1, 2].map((j) => (
            <Skeleton key={j} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [data, setData] = useState<PlatformIntelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/intelligence', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      setData(await res.json() as PlatformIntelligence)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-5 w-5 text-purple" aria-hidden="true" />
              <h1 className="text-lg font-black text-white tracking-tight">Civic Intelligence</h1>
            </div>
            <p className="text-xs text-surface-500">
              Weekly data-driven analysis of civic discourse patterns
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            aria-label="Refresh intelligence report"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Refresh
          </button>
        </div>

        {loading && <IntelligenceSkeleton />}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Brain className="h-10 w-10 text-surface-500" aria-hidden="true" />
            <p className="text-sm text-surface-500">Could not load intelligence report.</p>
            <button
              onClick={() => load()}
              className="px-4 py-2 rounded-lg bg-for-600 text-white text-xs font-semibold hover:bg-for-700 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {data && !loading && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >

              {/* ── Civic Intelligence Index ─────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <IndexGauge
                    score={data.index}
                    label={data.index_label}
                    delta={data.index_delta}
                  />
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-xs text-surface-500 font-mono uppercase tracking-wider mb-1">
                        Week of {data.week.label}
                      </p>
                      <p className="text-sm text-surface-700 leading-relaxed">
                        The Civic Intelligence Index reflects platform engagement, discourse quality,
                        and consensus formation across all active topics.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
                        <div className="text-lg font-black font-mono text-white tabular-nums">
                          {data.signals.total_active_topics}
                        </div>
                        <div className="text-[10px] text-surface-500">Active topics</div>
                      </div>
                      <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
                        <div className="text-lg font-black font-mono text-gold tabular-nums">
                          {data.signals.laws_this_week}
                        </div>
                        <div className="text-[10px] text-surface-500">Laws this week</div>
                      </div>
                      <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
                        <div className="text-lg font-black font-mono text-for-400 tabular-nums">
                          {data.signals.total_votes_cast.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-surface-500">Total votes cast</div>
                      </div>
                      <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
                        <div className="text-lg font-black font-mono text-purple tabular-nums">
                          {data.signals.new_arguments_this_week}
                        </div>
                        <div className="text-[10px] text-surface-500">Arguments this week</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Polarization vs consensus highlight */}
                <div className="mt-4 pt-4 border-t border-surface-300/60 grid grid-cols-2 gap-3">
                  {data.signals.most_consensual_category && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-surface-500">Most consensual</p>
                        <p className="text-xs font-semibold text-emerald">{data.signals.most_consensual_category}</p>
                      </div>
                    </div>
                  )}
                  {data.signals.most_polarized_category && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-against-500 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-surface-500">Most polarized</p>
                        <p className="text-xs font-semibold text-against-400">{data.signals.most_polarized_category}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Consensus Velocity Leaders ───────────────────────────── */}
              {data.velocity_leaders.length > 0 && (
                <Section
                  icon={Zap}
                  title="Consensus Velocity"
                  subtitle="Topics building fastest toward a decision"
                  iconClass="text-for-400"
                >
                  <div className="space-y-2">
                    {data.velocity_leaders.map((t, i) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <VelocityCard topic={t} rank={i + 1} />
                      </motion.div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ── Law Pipeline ─────────────────────────────────────────── */}
              {data.law_pipeline.length > 0 && (
                <Section
                  icon={Gavel}
                  title="Law Pipeline"
                  subtitle="Topics most likely to become law this week"
                  iconClass="text-gold"
                >
                  <div className="space-y-2">
                    {data.law_pipeline.map((t, i) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <PipelineCard topic={t} />
                      </motion.div>
                    ))}
                  </div>
                  <Link
                    href="/law"
                    className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold/80 transition-colors font-semibold mt-1"
                  >
                    View Law Codex <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Section>
              )}

              {/* ── Most Contested ───────────────────────────────────────── */}
              {data.most_contested.length > 0 && (
                <Section
                  icon={Scale}
                  title="Most Contested"
                  subtitle="Closest to 50/50 — genuine democratic deadlocks"
                  iconClass="text-against-400"
                >
                  <div className="space-y-2">
                    {data.most_contested.map((t) => (
                      <Link
                        key={t.id}
                        href={`/topic/${t.id}`}
                        className="group flex items-center gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-against-500/30 hover:bg-surface-200 transition-all"
                      >
                        <Scale className="h-4 w-4 text-against-400 flex-shrink-0" aria-hidden="true" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-xs font-medium text-white leading-snug line-clamp-2 group-hover:text-against-300 transition-colors">
                            {t.statement}
                          </p>
                          <MiniVoteBar bluePct={t.blue_pct} />
                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="font-mono text-for-400">{Math.round(t.blue_pct)}%</span>
                            <span className="text-surface-500">vs</span>
                            <span className="font-mono text-against-400">{100 - Math.round(t.blue_pct)}%</span>
                            <span className="text-surface-500">{t.total_votes.toLocaleString()} votes</span>
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-against-400 transition-colors" />
                      </Link>
                    ))}
                  </div>
                  <Link href="/split" className="inline-flex items-center gap-1.5 text-xs text-against-400 hover:text-against-300 transition-colors font-semibold mt-1">
                    See all contested debates <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Section>
              )}

              {/* ── Under the Radar ──────────────────────────────────────── */}
              {data.under_radar.length > 0 && (
                <Section
                  icon={Eye}
                  title="Under the Radar"
                  subtitle="Strong consensus forming quietly — before the crowd arrives"
                  iconClass="text-purple"
                >
                  <div className="space-y-2">
                    {data.under_radar.map((t) => (
                      <Link
                        key={t.id}
                        href={`/topic/${t.id}`}
                        className="group flex items-center gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-purple/30 hover:bg-surface-200 transition-all"
                      >
                        <div className="flex-shrink-0 h-6 w-6 rounded-full bg-purple/10 border border-purple/30 flex items-center justify-center">
                          <Eye className="h-3 w-3 text-purple" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-xs font-medium text-white leading-snug line-clamp-2 group-hover:text-purple transition-colors">
                            {t.statement}
                          </p>
                          <MiniVoteBar bluePct={t.blue_pct} />
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="font-mono text-for-400">{Math.round(t.blue_pct)}% FOR</span>
                            <span className="text-surface-500">·</span>
                            <span className="text-surface-500 italic">only {t.total_votes} votes so far</span>
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-purple transition-colors" />
                      </Link>
                    ))}
                  </div>
                </Section>
              )}

              {/* ── Belief Shifts ────────────────────────────────────────── */}
              {data.belief_shifts.length > 0 && (
                <Section
                  icon={TrendingUp}
                  title="Belief Shifts"
                  subtitle="Topics where votes have moved most significantly"
                  iconClass="text-emerald"
                >
                  <div className="space-y-2">
                    {data.belief_shifts.map((bs) => (
                      <Link
                        key={bs.topic_id}
                        href={`/topic/${bs.topic_id}`}
                        className="group flex items-start gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-emerald/30 hover:bg-surface-200 transition-all"
                      >
                        <div className={cn(
                          'flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold',
                          bs.shift > 0 ? 'bg-for-500/15 text-for-300 border border-for-500/30' : 'bg-against-500/15 text-against-300 border border-against-500/30'
                        )}>
                          {bs.shift > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                          {Math.abs(bs.shift).toFixed(1)}%
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs font-medium text-white leading-snug line-clamp-2 group-hover:text-emerald transition-colors">
                            {bs.topic_statement}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-surface-500">
                            <span className="font-mono">{Math.round(bs.blue_pct_7d_ago)}%</span>
                            <span>→</span>
                            <span className="font-mono text-for-400">{Math.round(bs.blue_pct_now)}%</span>
                            {bs.category && <span>· {bs.category}</span>}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </Section>
              )}

              {/* ── Category Heat Map ────────────────────────────────────── */}
              {data.category_intel.length > 0 && (
                <Section
                  icon={Flame}
                  title="Category Heat"
                  subtitle="Civic engagement intensity by policy domain"
                  iconClass="text-against-400"
                >
                  <div className="rounded-xl bg-surface-200/50 border border-surface-300/50 p-4 space-y-3">
                    {data.category_intel.map((cat) => (
                      <Link
                        key={cat.category}
                        href={`/categories/${cat.category.toLowerCase()}`}
                        className="block group"
                      >
                        <CategoryHeatRow cat={cat} />
                      </Link>
                    ))}
                  </div>
                  <Link href="/categories" className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors font-semibold mt-1">
                    Browse all categories <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Section>
              )}

              {/* ── Argument of the Week ─────────────────────────────────── */}
              {data.argument_of_the_week && (
                <Section
                  icon={MessageSquare}
                  title="Argument of the Week"
                  subtitle="Highest AI-scored argument from the past 7 days"
                  iconClass="text-for-400"
                >
                  <div className="rounded-2xl bg-surface-100 border border-for-500/20 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={data.argument_of_the_week.side === 'blue' ? 'active' : 'failed'}
                        className="text-[10px]"
                      >
                        {data.argument_of_the_week.side === 'blue' ? 'FOR' : 'AGAINST'}
                      </Badge>
                      {data.argument_of_the_week.ai_score !== null && (
                        <span className="text-[10px] font-mono text-gold bg-gold/10 border border-gold/30 rounded-md px-1.5 py-0.5">
                          {Math.round(data.argument_of_the_week.ai_score)}/100 AI score
                        </span>
                      )}
                    </div>
                    <blockquote className="text-sm text-surface-700 leading-relaxed italic border-l-2 border-for-500/40 pl-4">
                      &ldquo;{data.argument_of_the_week.content.slice(0, 320)}
                      {data.argument_of_the_week.content.length > 320 ? '…' : ''}&rdquo;
                    </blockquote>
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/profile/${data.argument_of_the_week.author_username}`}
                        className="flex items-center gap-2 group"
                      >
                        <Avatar
                          src={data.argument_of_the_week.author_avatar_url}
                          fallback={data.argument_of_the_week.author_display_name ?? data.argument_of_the_week.author_username}
                          size="sm"
                        />
                        <div>
                          <p className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors">
                            {data.argument_of_the_week.author_display_name ?? `@${data.argument_of_the_week.author_username}`}
                          </p>
                          <span className={cn(
                            'text-[9px] border rounded-md px-1 py-px',
                            roleBadgeClass(data.argument_of_the_week.author_role)
                          )}>
                            {roleLabel(data.argument_of_the_week.author_role)}
                          </span>
                        </div>
                      </Link>
                      <Link
                        href={`/topic/${data.argument_of_the_week.topic_id}`}
                        className="flex items-center gap-1 text-[10px] text-surface-500 hover:text-for-400 transition-colors"
                      >
                        View debate <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </Section>
              )}

              {/* ── Rising Citizens ──────────────────────────────────────── */}
              {data.rising_citizens.length > 0 && (
                <Section
                  icon={Sparkles}
                  title="Rising Citizens"
                  subtitle="Most active voices in the Lobby this week"
                  iconClass="text-purple"
                >
                  <div className="space-y-2">
                    {data.rising_citizens.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                      >
                        <Link
                          href={`/profile/${p.username}`}
                          className="group flex items-center gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-purple/30 hover:bg-surface-200 transition-all"
                        >
                          <Avatar
                            src={p.avatar_url}
                            fallback={p.display_name ?? p.username}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-white group-hover:text-purple transition-colors truncate">
                                {p.display_name ?? `@${p.username}`}
                              </p>
                              <span className={cn('text-[9px] border rounded px-1 py-px flex-shrink-0', roleBadgeClass(p.role))}>
                                {roleLabel(p.role)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-surface-500 mt-0.5">
                              <span className="font-mono text-gold">{p.clout.toLocaleString()} clout</span>
                              <span>{p.total_votes.toLocaleString()} votes</span>
                              <span>{p.total_arguments} args</span>
                            </div>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-purple transition-colors" />
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                  <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-xs text-purple hover:text-purple/80 transition-colors font-semibold mt-1">
                    Full leaderboard <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Section>
              )}

              {/* ── Footer ──────────────────────────────────────────────── */}
              <div className="flex items-center justify-between pt-2 border-t border-surface-300/60">
                <p className="text-[10px] text-surface-600">
                  Generated {relTime(data.generated_at)} · Updates hourly
                </p>
                <div className="flex items-center gap-3">
                  <Link href="/signals" className="text-[10px] text-surface-500 hover:text-white transition-colors">Real-time signals</Link>
                  <Link href="/vitals" className="text-[10px] text-surface-500 hover:text-white transition-colors">Platform vitals</Link>
                  <Link href="/digest" className="text-[10px] text-surface-500 hover:text-white transition-colors">Weekly digest</Link>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>
      <BottomNav />
    </div>
  )
}
